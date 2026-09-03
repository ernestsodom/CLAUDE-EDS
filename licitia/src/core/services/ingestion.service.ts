import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts, MODELS } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { extractText, extractZipEntries } from "./extraction.service";
import { chunkPages } from "./chunking.service";
import {
  classifyDocument,
  extractDeliveredItems,
  extractEvaluation,
  extractRequirements,
  extractSystems,
  extractTimeline,
  summarizeDocument,
} from "./analysis.service";
import {
  classifyDocumentLocal,
  extractDeliveredItemsLocal,
  extractEvaluationLocal,
  extractRequirementsLocal,
  extractSystemsLocal,
  extractTimelineLocal,
  summarizeLocal,
} from "./heuristic.service";
import { audit } from "./audit.service";
import { usageLogger } from "./ai-usage.service";
import { resolveTimelineDates } from "./timeline-resolver";
import { sanitizeStorageFileName } from "@/lib/utils";
import { useBlobStorage, uploadBuffer, downloadBlob } from "@/lib/storage";
import type { PageText } from "@/core/domain/types";
import {
  ENGINE_LABELS,
  getProviderInfo,
  isProviderConfigured,
  isProviderId,
  listAutoProviders,
  type AnalysisMode,
  type ProviderId,
} from "@/lib/ai-providers";

export type { AnalysisMode } from "@/lib/ai-providers";
export { ENGINE_LABELS } from "@/lib/ai-providers";

// ─── Motor de análisis ──────────────────────────────────────────────────────
//
// El usuario elige explícitamente el motor para cada documento — no hay
// degradación silenciosa por defecto: solo el modo 'auto' (una elección más,
// no la implícita) prueba varios proveedores antes de caer al motor local.
//
//   'gemini' | 'groq' → un proveedor concreto. Si falla, falla: el resultado
//                        se reporta tal cual, sin cambiar de motor por su cuenta.
//   'local'           → siempre el motor local por patrones (sin cuota, sin costo).
//   'auto'            → intenta los proveedores configurados en el orden de
//                        preferencia y, si todos se quedan sin cuota, continúa
//                        en el motor local. Sigue siendo una elección explícita
//                        del usuario, solo que delega el orden de intentos.
//
const QUOTA_ERROR =
  /(429|quota|rate.?limit|resource.?exhausted|too many requests|exceeded|insufficient|billing|timeout|ETIMEDOUT)/i;

export function isQuotaError(err: unknown): boolean {
  const m = err instanceof Error ? `${err.message}` : String(err);
  return QUOTA_ERROR.test(m);
}

/** Ejecuta el análisis con el motor elegido; 'auto' prueba proveedores en orden. */
async function analyze<T>(
  mode: AnalysisMode,
  runWithProvider: (provider: ProviderId) => Promise<T>,
  local: () => T
): Promise<{ data: T; engine: AnalysisMode }> {
  if (mode === "local") return { data: local(), engine: "local" };

  if (isProviderId(mode)) {
    // Elección explícita: si falla, se reporta el error tal cual tal como es.
    return { data: await runWithProvider(mode), engine: mode };
  }

  // 'auto': recorre los proveedores GRATUITOS configurados; si todos fallan
  // por cuota, continúa en el motor local. Nunca encadena un proveedor de
  // pago: eso gastaría dinero sin que el usuario lo haya pedido.
  for (const provider of listAutoProviders()) {
    try {
      return { data: await runWithProvider(provider), engine: provider };
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      logger.warn("provider_quota_exhausted", {
        provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { data: local(), engine: "local" };
}

/**
 * Corre una promesa con un tope de tiempo propio, bien por debajo del límite
 * de la función serverless (ver comentario del pipeline más abajo). Sin
 * esto, una llamada a la IA que se cuelga o tarda demasiado no lanza
 * ninguna excepción manejable — la plataforma mata la función a la fuerza
 * (o responde 504 Gateway Timeout ella misma) antes de que el catch de
 * runNextStage llegue a registrar un error útil, y el usuario ve un "Error
 * 504" genérico o el documento queda "procesando" sin ninguna pista de qué
 * pasó (visto en producción, en distintas etapas — clasificación, resumen,
 * sistemas, requerimientos, línea de tiempo — con documentos grandes).
 *
 * Con el timeout propio, en cambio, se lanza un error claro con tiempo de
 * sobra para guardarlo — y como el mensaje incluye "timeout", el cliente
 * (processDocument) lo reintenta solo, sin que el usuario tenga que hacer
 * nada. Se aplica a TODAS las etapas que llaman a un proveedor de IA, no
 * solo a la que falló la última vez: la causa (demasiado texto + demasiado
 * tiempo de generación para el límite de 60s de la función) es la misma en
 * cualquiera de ellas.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} tardó demasiado (timeout de ${Math.round(ms / 1000)}s) y se interrumpió.`)),
        ms
      )
    ),
  ]);
}

/**
 * Tope interno para cada etapa que llama a la IA, usado con withTimeout()
 * en todas ellas. maxDuration de la función es 60s (ver runtime config de
 * /api/documents/:id/process) — este valor NO puede acercarse demasiado a
 * ese límite (dejaría a la plataforma sin margen para cortar la conexión
 * ella misma primero, volviendo al 504 crudo que este mecanismo existe
 * para evitar) NI quedarse demasiado corto (abortaría a la fuerza llamadas
 * que de verdad iban a terminar bien un poco más tarde, todavía dentro de
 * los 60s — la primera versión de este límite, en 45s, hacía justo eso:
 * documentos que antes procesaban lento pero sin problema empezaron a
 * fallar siempre, porque 45s ya no les alcanzaba). 52s deja ~8s de margen
 * para la lectura de páginas y el guardado en la base alrededor de la
 * llamada — suficiente en la práctica — sin sacrificar más de lo
 * necesario a las llamadas genuinamente lentas.
 */
const STAGE_TIMEOUT_MS = 52_000;

// ============================================================================
// CARGA (automática) y ANÁLISIS (a pedido).
//
// La carga deja el documento listo para consultar: extrae el texto, lo trocea
// y lo clasifica (título real, tipo, cliente, monto, región). Ahí termina.
// Ningún análisis de IA se ejecuta solo: cada uno —resumen, sistemas, línea
// de tiempo, evaluación y anexos, puntos críticos, vectores del chat— se pide
// por separado desde la ficha del documento.
//
// El porqué del cambio: antes la subida encadenaba las ocho etapas de una
// sola vez. Eso significaba esperar varios minutos por análisis que quizá
// nadie iba a mirar, agotar la cuota de los proveedores de IA en documentos
// que solo se querían archivar, y —lo peor— que el fallo de una etapa dejara
// al documento entero en "error" aunque las anteriores hubieran salido bien.
// Pidiendo cada parte por separado, se paga (en tiempo y cuota) solo lo que
// se usa, y el fallo de una parte no arrastra a las demás.
//
// Se conserva el troceado dentro de la carga —una llamada por etapa, el
// cliente repite hasta done=true— porque el motivo original sigue vigente:
// las funciones serverless tienen un límite de duración (60 s en el plan
// Hobby de Vercel) y no garantizan el trabajo lanzado "en segundo plano".
//
// Etapas de la carga (documents.processing_step marca la siguiente pendiente):
//   extraccion_texto → chunking → cargado
// Partes a pedido (una llamada cada una, ver runAnalysisPart):
//   clasificacion*, resumen, sistemas, timeline, evaluacion, criticos, chat
//   (*) la clasificación se ejecuta al final de la carga, no a pedido: sin
//   ella el documento aparecería en la lista con el nombre del archivo.
// ============================================================================

const EMBED_BATCH = 120;
/** Único proveedor con embeddings hoy; centralizado por si eso cambia. */
const EMBEDDING_PROVIDER: ProviderId = "gemini";

export interface StageParams {
  documentId: string;
  organizationId: string;
  userId: string | null;
  mode?: AnalysisMode;
}

export interface StageResult {
  step: string;
  done: boolean;
  detail?: string;
  engine?: AnalysisMode;
}

const NEXT: Record<string, string> = {
  extraccion_texto: "chunking",
  chunking: "clasificacion",
  clasificacion: "cargado",
};

/** Etiquetas legibles para la interfaz. */
export const STEP_LABELS: Record<string, string> = {
  extraccion_texto: "extrayendo texto",
  chunking: "dividiendo el documento",
  clasificacion: "clasificando",
  cargado: "cargado",
  // Se conservan las etiquetas de los pasos que ahora son partes a pedido:
  // documentos procesados con la versión anterior pueden tener cualquiera de
  // estos valores guardados en processing_step.
  embeddings: "generando vectores de búsqueda",
  resumen: "redactando el resumen",
  sistemas: "identificando los sistemas",
  requerimientos: "extrayendo puntos críticos",
  timeline: "construyendo la línea de tiempo",
  completado: "completado",
};

// ─── Partes que se analizan a pedido ────────────────────────────────────────

export const ANALYSIS_PARTS = [
  "resumen",
  "sistemas",
  "timeline",
  "evaluacion",
  "criticos",
  "chat",
] as const;
export type AnalysisPart = (typeof ANALYSIS_PARTS)[number];

export function isAnalysisPart(value: string): value is AnalysisPart {
  return (ANALYSIS_PARTS as readonly string[]).includes(value);
}

/** Título de cada parte en la ficha del documento. */
export const PART_LABELS: Record<AnalysisPart, string> = {
  resumen: "Resumen",
  sistemas: "Sistemas solicitados",
  timeline: "Línea de tiempo",
  evaluacion: "Evaluación y anexos",
  criticos: "Puntos críticos",
  chat: "Chat IA",
};

/** Qué produce cada parte, para que se entienda antes de gastar cuota en ella. */
export const PART_DESCRIPTIONS: Record<AnalysisPart, string> = {
  resumen:
    "Objetivo y alcance, plazo y presupuesto, obligaciones y restricciones, exigencia de ISO 9001/27001 y migración de datos.",
  sistemas: "El listado de los sistemas que la licitación solicita.",
  timeline: "Los hitos y plazos del proceso, con sus fechas.",
  evaluacion: "Criterios de evaluación con su ponderación y los anexos que hay que presentar.",
  criticos: "Garantías, SLA, multas, plazos, servidores, certificados y experiencia exigida.",
  chat: "Prepara la búsqueda por significado para poder preguntarle al documento en el Chat IA.",
};

/**
 * Avanza UNA etapa de la carga (extraer texto → trocear → clasificar). No
 * ejecuta ningún análisis: al terminar, el documento queda en "cargado" y es
 * el usuario quien pide cada parte por separado.
 */
export async function runNextStage(params: StageParams): Promise<StageResult> {
  const db = createAdminClient();
  const { documentId } = params;

  const { data: doc } = await db
    .from("documents")
    .select("id, doc_type, status, processing_step, doc_date")
    .eq("id", documentId)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  const mode: AnalysisMode = params.mode ?? "auto";
  const step = doc.processing_step ?? "extraccion_texto";
  // "completado" es el terminal de los documentos procesados con la versión
  // anterior del pipeline; "cargado", el de esta. Ambos significan que la
  // carga ya está hecha y no hay nada más que avanzar aquí.
  if (step === "cargado" || step === "completado") return { step, done: true };

  const { data: version } = await db
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .single();
  if (!version) throw new Error("El documento no tiene una versión activa");
  const versionId = version.id as string;

  const advance = async (to: string) => {
    const finished = to === "cargado";
    await db
      .from("documents")
      .update({
        processing_step: to,
        status: finished ? "cargado" : "procesando",
        processing_error: null,
      })
      .eq("id", documentId);
  };

  try {
    switch (step) {
      case "extraccion_texto": {
        const detail = await stageExtract(db, params, versionId, mode);
        if (detail === "zip") {
          await advance("cargado");
          return { step: "cargado", done: true, detail: "ZIP expandido" };
        }
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "chunking": {
        const detail = await stageChunk(db, documentId, versionId);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "clasificacion": {
        const r = await stageClassify(db, params, versionId, mode);
        await advance("cargado");
        await audit(params.organizationId, params.userId, "document.loaded", "document", documentId);
        logger.info("document_loaded", { documentId, mode });
        return { step: "cargado", done: true, detail: r.detail, engine: r.engine };
      }

      default: {
        // Cualquier paso de la versión anterior (embeddings, resumen,
        // sistemas…) que quedara guardado a medias: la carga en sí ya estaba
        // hecha, así que se cierra sin repetirla. Lo que falte se pide ahora
        // como parte.
        await advance("cargado");
        return { step: "cargado", done: true };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("stage_failed", { documentId, step, error: message });
    await db
      .from("documents")
      .update({ status: "error", processing_error: `[${step}] ${message}` })
      .eq("id", documentId);
    throw err;
  }
}

/** Ejecuta la carga completa de una vez (entornos sin límite de duración). */
export async function processDocumentFully(params: StageParams): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const r = await runNextStage(params);
    if (r.done) return;
  }
  throw new Error("La carga superó el número máximo de etapas");
}

// ─── Análisis a pedido ──────────────────────────────────────────────────────

export interface PartResult {
  part: AnalysisPart;
  done: boolean;
  detail?: string;
  engine?: AnalysisMode;
}

/**
 * Ejecuta UNA parte del análisis, a pedido. Cada parte es independiente: si
 * falla, solo se marca esa como fallida — las demás conservan su resultado.
 *
 * `chat` (los vectores) es la única que puede necesitar varias llamadas: se
 * vectoriza por lotes y devuelve done=false mientras queden fragmentos.
 */
export async function runAnalysisPart(
  params: StageParams & { part: AnalysisPart }
): Promise<PartResult> {
  const db = createAdminClient();
  const { documentId, part } = params;
  const mode: AnalysisMode = params.mode ?? "auto";

  const { data: doc } = await db
    .from("documents")
    .select("id, doc_type, processing_step, doc_date")
    .eq("id", documentId)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  const { data: version } = await db
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .single();
  if (!version) throw new Error("El documento no tiene una versión activa");
  const versionId = version.id as string;

  // Sin texto extraído no hay nada que analizar: es la carga la que lo
  // produce, y se pudo haber interrumpido a mitad.
  const { count: pageCount } = await db
    .from("document_pages")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId);
  if (!pageCount) {
    throw new Error(
      "El documento todavía no tiene texto extraído. Vuelve a cargarlo antes de analizarlo."
    );
  }

  await setPartStatus(db, documentId, versionId, part, { status: "procesando", error: null });

  try {
    const result = await runPart(db, params, versionId, doc, mode);
    await setPartStatus(db, documentId, versionId, part, {
      status: result.done ? "listo" : "procesando",
      error: null,
      engine: result.engine ?? mode,
    });
    if (result.done) {
      await audit(params.organizationId, params.userId, `document.analyzed.${part}`, "document", documentId);
      logger.info("document_part_analyzed", { documentId, part, mode });
      if (COMPARISON_PARTS.has(part)) {
        await maybeMarkProcesado(db, documentId, versionId);
      }
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("part_failed", { documentId, part, error: message });
    await setPartStatus(db, documentId, versionId, part, { status: "error", error: message });
    throw err;
  }
}

/** El trabajo de cada parte, sin el registro de estado que lo envuelve. */
async function runPart(
  db: DB,
  params: StageParams & { part: AnalysisPart },
  versionId: string,
  doc: { doc_type: string; doc_date: string | null },
  mode: AnalysisMode
): Promise<PartResult> {
  const { documentId, part, organizationId, userId } = params;

  switch (part) {
    case "resumen": {
      const r = await stageSummary(db, documentId, versionId, mode, organizationId, userId);
      return { part, done: true, engine: r.engine };
    }
    case "sistemas": {
      const r = await stageSystems(db, documentId, versionId, doc.doc_type, mode, organizationId, userId);
      return { part, done: true, detail: r.detail, engine: r.engine };
    }
    case "timeline": {
      const r = await stageTimeline(db, documentId, versionId, doc.doc_date, mode, organizationId, userId);
      return { part, done: true, detail: r.detail, engine: r.engine };
    }
    case "evaluacion": {
      const r = await stageEvaluation(db, documentId, versionId, mode, organizationId, userId);
      return { part, done: true, detail: r.detail, engine: r.engine };
    }
    case "criticos": {
      const r = await stageRequirements(db, documentId, versionId, doc.doc_type, mode, organizationId, userId);
      return { part, done: true, detail: r.detail, engine: r.engine };
    }
    case "chat": {
      const r = await stageEmbeddings(db, documentId, versionId, mode);
      return { part, done: r.done, detail: r.detail };
    }
  }
}

/** Estado de cada parte, por versión: lo que la ficha muestra en cada tarjeta. */
async function setPartStatus(
  db: DB,
  documentId: string,
  versionId: string,
  part: AnalysisPart,
  fields: { status: string; error: string | null; engine?: AnalysisMode }
) {
  await db.from("document_analysis_parts").upsert(
    {
      document_id: documentId,
      version_id: versionId,
      part,
      status: fields.status,
      error: fields.error,
      ...(fields.engine ? { engine: fields.engine } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "version_id,part" }
  );
}

/**
 * Partes de las que dependen el comparador y el cuadro comparativo:
 * sistemas (tabla `systems`) y críticos (tabla `requirements`, de donde salen
 * certificados/migración). Cuando ambas quedan "listo", el documento pasa a
 * `procesado` — el estado que esas pantallas siguen usando para habilitar la
 * comparación — sin que la carga sola (ni el resumen, timeline o evaluación
 * por separado) lo dispare.
 */
const COMPARISON_PARTS = new Set<AnalysisPart>(["sistemas", "criticos"]);

async function maybeMarkProcesado(db: DB, documentId: string, versionId: string) {
  const { data: rows } = await db
    .from("document_analysis_parts")
    .select("part, status")
    .eq("version_id", versionId)
    .in("part", Array.from(COMPARISON_PARTS));
  const ready = Array.from(COMPARISON_PARTS).every(
    (p) => rows?.some((r) => r.part === p && r.status === "listo")
  );
  if (ready) {
    await db.from("documents").update({ status: "procesado" }).eq("id", documentId);
  }
}

// ─── Etapas ─────────────────────────────────────────────────────────────────

type DB = ReturnType<typeof createAdminClient>;

async function loadPages(db: DB, versionId: string): Promise<PageText[]> {
  const { data } = await db
    .from("document_pages")
    .select("page_number, content, ocr_used")
    .eq("version_id", versionId)
    .order("page_number");
  return (data ?? []).map((p) => ({
    pageNumber: p.page_number,
    content: p.content,
    ocrUsed: p.ocr_used,
  }));
}

async function stageExtract(
  db: DB,
  params: StageParams,
  versionId: string,
  mode: AnalysisMode
): Promise<string> {
  const { data: file } = await db
    .from("files")
    .select("*")
    .eq("version_id", versionId)
    .limit(1)
    .single();
  if (!file) throw new Error("Archivo no encontrado para la versión");

  let buffer: Buffer;
  if (useBlobStorage()) {
    buffer = await downloadBlob(file.storage_path);
  } else {
    const { data: blob, error } = await db.storage.from("documents").download(file.storage_path);
    if (error || !blob) throw new Error(`Error descargando el archivo: ${error?.message}`);
    buffer = Buffer.from(await blob.arrayBuffer());
  }

  if (file.mime_type.includes("zip") || file.file_name.toLowerCase().endsWith(".zip")) {
    await expandZip(db, params, buffer);
    return "zip";
  }

  const extracted = await extractText(
    { buffer, mimeType: file.mime_type, fileName: file.file_name },
    { mode }
  );
  const pages = extracted.pages.filter((p) => p.content.length > 0);
  if (pages.length === 0) throw new Error("El documento no contiene texto extraíble");

  await db.from("document_pages").delete().eq("version_id", versionId);
  await db.from("document_pages").insert(
    pages.map((p) => ({
      version_id: versionId,
      page_number: p.pageNumber,
      content: p.content,
      ocr_used: p.ocrUsed,
    }))
  );
  await db
    .from("documents")
    .update({ page_count: pages.length, is_scanned: extracted.isScanned })
    .eq("id", params.documentId);

  return `${pages.length} páginas${extracted.isScanned ? " (OCR aplicado)" : ""}`;
}

async function stageChunk(db: DB, documentId: string, versionId: string): Promise<string> {
  const pages = await loadPages(db, versionId);
  const chunks = chunkPages(pages);
  await db.from("document_chunks").delete().eq("version_id", versionId);

  const ROWS = 300;
  for (let i = 0; i < chunks.length; i += ROWS) {
    const { error } = await db.from("document_chunks").insert(
      chunks.slice(i, i + ROWS).map((c) => ({
        document_id: documentId,
        version_id: versionId,
        chunk_index: c.index,
        content: c.content,
        page_start: c.pageStart,
        page_end: c.pageEnd,
        section: c.section,
        token_count: c.tokenCount,
      }))
    );
    if (error) throw new Error(`Error guardando fragmentos: ${error.message}`);
  }
  return `${chunks.length} fragmentos`;
}

/**
 * Vectores de búsqueda para el Chat IA. Se pide como una parte más porque
 * consume cuota de Gemini y solo hace falta si se va a conversar con ese
 * documento en concreto.
 *
 * Devuelve done=false mientras queden fragmentos por vectorizar: se procesa
 * por lotes para caber en el límite de duración de la función.
 */
async function stageEmbeddings(
  db: DB,
  documentId: string,
  versionId: string,
  mode: AnalysisMode
): Promise<{ done: boolean; detail?: string }> {
  // Solo Gemini genera embeddings hoy. Con cualquier motor que no los ofrezca
  // se omiten sin más: la búsqueda sigue funcionando por texto completo en
  // español. Se decide por capacidad declarada del proveedor, no por su
  // nombre, para que sumar uno nuevo no obligue a tocar esta condición.
  const providerInfo = isProviderId(mode) ? getProviderInfo(mode) : null;
  if (mode === "local" || (isProviderId(mode) && !providerInfo?.supportsEmbeddings)) {
    return {
      done: true,
      detail: `vectores omitidos (${ENGINE_LABELS[mode]} no genera embeddings; el chat buscará por texto)`,
    };
  }
  if (!isProviderConfigured(EMBEDDING_PROVIDER)) {
    return { done: true, detail: "vectores omitidos (Gemini no configurado)" };
  }

  try {
    const remaining = await stageEmbedBatch(db, versionId);
    if (remaining > 0) return { done: false, detail: `${remaining} fragmentos pendientes` };
  } catch (err) {
    // Los vectores son una mejora (búsqueda semántica), no un requisito para
    // poder consultar el documento: ante falta de cuota se omiten en
    // cualquier modo, incluido 'gemini' explícito.
    if (!isQuotaError(err)) throw err;
    logger.warn("embeddings_skipped_quota", { documentId });
    return { done: true, detail: "vectores omitidos por falta de cuota" };
  }
  return { done: true, detail: "chat listo para consultar este documento" };
}

/** Vectoriza un lote (siempre con Gemini) y devuelve cuántos quedan pendientes. */
async function stageEmbedBatch(db: DB, versionId: string): Promise<number> {
  const { data: pending } = await db
    .from("document_chunks")
    .select("id, content")
    .eq("version_id", versionId)
    .is("embedding", null)
    .order("chunk_index")
    .limit(EMBED_BATCH);

  if (!pending || pending.length === 0) return 0;

  const vectors = await embedTexts(pending.map((c) => c.content));
  for (let i = 0; i < pending.length; i++) {
    const { error } = await db
      .from("document_chunks")
      .update({ embedding: JSON.stringify(vectors[i]) })
      .eq("id", pending[i].id);
    if (error) throw new Error(`Error guardando vectores: ${error.message}`);
  }

  const { count } = await db
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("version_id", versionId)
    .is("embedding", null);
  return count ?? 0;
}

function engineSuffix(engine: AnalysisMode): string {
  return engine === "gemini" ? "" : ` (${ENGINE_LABELS[engine]})`;
}

async function stageClassify(
  db: DB,
  params: StageParams,
  versionId: string,
  mode: AnalysisMode
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({
    organizationId: params.organizationId,
    documentId: params.documentId,
    userId: params.userId,
    feature: "clasificacion",
  });
  const { data: c, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => classifyDocument(pages, provider, onUsage),
      () => classifyDocumentLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "La clasificación del documento"
  );

  await db
    .from("documents")
    .update({
      doc_type: c.tipo_documento,
      tender_number: c.numero_licitacion,
      tender_name: c.nombre_licitacion,
      market_id: c.id_mercado_publico,
      provider: c.proveedor,
      area: c.area,
      project_type: c.tipo_proyecto,
      country: c.pais,
      region: c.region,
      city: c.ciudad,
      doc_date: c.fecha,
      amount: c.monto,
      currency: c.moneda ?? "CLP",
      contract_duration: c.duracion_contrato,
      language: c.idioma ?? "es",
      doc_state: c.estado_documento,
      classification: { ...c, _motor: engine },
      ...(c.titulo_sugerido ? { title: c.titulo_sugerido } : {}),
    })
    .eq("id", params.documentId);

  await linkClient(db, params.organizationId, params.documentId, c.cliente, c.tipo_cliente);
  return { detail: `${c.tipo_documento.replace(/_/g, " ")}${engineSuffix(engine)}`, engine };
}

async function stageSummary(
  db: DB,
  documentId: string,
  versionId: string,
  mode: AnalysisMode,
  organizationId: string,
  userId: string | null
): Promise<{ engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({ organizationId, documentId, userId, feature: "resumen" });
  const { data: s, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => summarizeDocument(pages, provider, onUsage),
      () => summarizeLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "El resumen ejecutivo"
  );
  // Solo los campos del resumen: la evaluación y los anexos son su propia
  // parte (stageEvaluation) y escriben en esta misma fila sin pisar esto.
  await db.from("document_summaries").upsert(
    {
      document_id: documentId,
      version_id: versionId,
      summary: s.resumen_general,
      objective: s.objetivo,
      scope: s.alcance,
      implementation_deadline: s.plazo_implementacion,
      budget_amount: s.presupuesto?.monto ?? null,
      budget_currency: s.presupuesto?.moneda ?? null,
      budget_period: s.presupuesto?.periodicidad ?? null,
      budget_detail: s.presupuesto?.detalle ?? null,
      obligations: s.obligaciones,
      restrictions: s.restricciones,
      iso_9001: s.certificaciones.iso_9001,
      iso_27001: s.certificaciones.iso_27001,
      data_migration: s.migracion_datos,
      model: engine === "local" ? "motor-local" : engine === "gemini" ? MODELS.chat : engine,
    },
    { onConflict: "version_id" }
  );
  return { engine };
}

/**
 * Criterios de evaluación y anexos exigidos. Comparte fila con el resumen
 * (una por versión) pero se pide aparte: son las dos cosas que se consultan
 * al armar la oferta, y juntarlas en una sola llamada era lo que hacía que
 * el resumen se pasara del límite de tiempo.
 */
async function stageEvaluation(
  db: DB,
  documentId: string,
  versionId: string,
  mode: AnalysisMode,
  organizationId: string,
  userId: string | null
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({ organizationId, documentId, userId, feature: "evaluacion" });
  const { data: e, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => extractEvaluation(pages, provider, onUsage),
      () => extractEvaluationLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "La extracción de criterios de evaluación y anexos"
  );

  await db.from("document_summaries").upsert(
    {
      document_id: documentId,
      version_id: versionId,
      evaluation_criteria: e.criterios_evaluacion,
      evaluation_methodology: e.metodologia_evaluacion,
      requested_annexes: e.anexos_solicitados,
    },
    { onConflict: "version_id" }
  );

  return {
    detail: `${e.criterios_evaluacion.length} criterios, ${e.anexos_solicitados.length} anexos${engineSuffix(engine)}`,
    engine,
  };
}

/**
 * El listado de sistemas que el documento exige — sin sus funcionalidades
 * (ver SystemsSchema para el porqué). Los documentos de control/avance no
 * describen lo exigido sino lo entregado, así que se saltan esta parte.
 */
async function stageSystems(
  db: DB,
  documentId: string,
  versionId: string,
  docType: string,
  mode: AnalysisMode,
  organizationId: string,
  userId: string | null
): Promise<{ detail: string; engine: AnalysisMode }> {
  if (["control_entregas", "avance", "acta", "reclamo"].includes(docType)) {
    return { detail: "no aplica a este tipo de documento", engine: mode };
  }

  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({ organizationId, documentId, userId, feature: "sistemas" });
  const { data: s, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => extractSystems(pages, provider, onUsage),
      () => extractSystemsLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "La extracción de sistemas"
  );

  // Borrar y reinsertar. El borrado en cascada se lleva las funcionalidades
  // que hubieran quedado de un análisis anterior: esta parte ya no las
  // extrae, y dejarlas colgando de sistemas que ya no existen sería peor que
  // no tenerlas.
  await db.from("systems").delete().eq("document_id", documentId);

  if (s.sistemas.length > 0) {
    const { error } = await db.from("systems").insert(
      s.sistemas.map((sys, i) => ({
        document_id: documentId,
        name: sys.nombre,
        description: sys.descripcion,
        deadline_text: sys.plazo,
        page: sys.pagina,
        quote: sys.cita,
        sort_order: i,
      }))
    );
    if (error) throw new Error(`Error guardando sistemas: ${error.message}`);
  }

  return {
    detail: `${s.sistemas.length} sistemas${engineSuffix(engine)}`,
    engine,
  };
}

async function stageRequirements(
  db: DB,
  documentId: string,
  versionId: string,
  docType: string,
  mode: AnalysisMode,
  organizationId: string,
  userId: string | null
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({ organizationId, documentId, userId, feature: "requerimientos" });

  // Documentos de control/avance: se extraen las entregas realizadas
  // (incluidos trabajos adicionales y gratuitos) en lugar de requerimientos.
  if (["control_entregas", "avance", "informe", "acta"].includes(docType)) {
    const { data: d, engine } = await withTimeout(
      analyze(
        mode,
        (provider) => extractDeliveredItems(pages, provider, onUsage),
        () => extractDeliveredItemsLocal(pages)
      ),
      STAGE_TIMEOUT_MS,
      "La extracción de entregas"
    );
    await db.from("delivered_items").delete().eq("document_id", documentId);
    if (d.entregas.length > 0) {
      await db.from("delivered_items").insert(
        d.entregas.map((e) => ({
          document_id: documentId,
          title: e.titulo,
          description: e.descripcion,
          delivered_on: e.fecha_entrega,
          delivery_state: e.estado,
          is_additional: e.es_adicional,
          is_free: e.es_gratuito,
          requirement_ref: e.referencia_requerimiento,
          page: e.pagina,
          quote: e.cita,
          confidence: e.confianza,
        }))
      );
    }
    return { detail: `${d.entregas.length} entregas${engineSuffix(engine)}`, engine };
  }

  const { data: r, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => extractRequirements(pages, provider, onUsage),
      () => extractRequirementsLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "La extracción de puntos críticos"
  );
  await db.from("requirements").delete().eq("document_id", documentId);
  if (r.requerimientos.length > 0) {
    await db.from("requirements").insert(
      r.requerimientos.map((x) => ({
        document_id: documentId,
        code: x.codigo,
        title: x.titulo,
        description: x.descripcion,
        category: x.tipo_critico,
        critical_type: x.tipo_critico,
        mandatory: x.obligatorio,
        deadline_text: x.plazo,
        value_text: x.valor,
        calc_base: x.base_calculo,
        condition_text: x.condicion,
        page: x.pagina,
        quote: x.cita,
        priority: x.prioridad,
      }))
    );
  }
  return { detail: `${r.requerimientos.length} puntos críticos${engineSuffix(engine)}`, engine };
}

async function stageTimeline(
  db: DB,
  documentId: string,
  versionId: string,
  docDate: string | null,
  mode: AnalysisMode,
  organizationId: string,
  userId: string | null
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const onUsage = usageLogger({ organizationId, documentId, userId, feature: "timeline" });
  const { data: t, engine } = await withTimeout(
    analyze(
      mode,
      (provider) => extractTimeline(pages, provider, onUsage),
      () => extractTimelineLocal(pages)
    ),
    STAGE_TIMEOUT_MS,
    "La extracción de la línea de tiempo"
  );
  if (t.hitos.length === 0) return { detail: `sin hitos${engineSuffix(engine)}`, engine };

  // Convierte los plazos relativos ("40 días desde la firma del contrato")
  // en fechas calendario concretas, usando la fecha del documento como
  // ancla — ver timeline-resolver.ts para el porqué y las marca como
  // estimadas para que nunca se muestren como un dato literal del documento.
  const resolved = resolveTimelineDates(t.hitos, docDate);

  await db.from("timelines").delete().eq("document_id", documentId);
  const { data: tl } = await db
    .from("timelines")
    .insert({ document_id: documentId })
    .select("id")
    .single();
  if (tl) {
    await db.from("milestones").insert(
      resolved.map((h, i) => ({
        timeline_id: tl.id,
        milestone_type: h.tipo,
        title: h.titulo,
        description: h.descripcion,
        starts_on: h.fecha_inicio,
        ends_on: h.fecha_fin,
        duration_label: h.plazo_texto,
        is_estimated: h.fecha_estimada,
        page: h.pagina,
        quote: h.cita,
        sort_order: i,
      }))
    );
  }
  return { detail: `${t.hitos.length} hitos${engineSuffix(engine)}`, engine };
}

// ─── Auxiliares ─────────────────────────────────────────────────────────────

async function linkClient(
  db: DB,
  organizationId: string,
  documentId: string,
  clientName: string | null,
  kind: string | null
) {
  if (!clientName?.trim()) return;
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", clientName.trim())
    .limit(1)
    .maybeSingle();

  let clientId = existing?.id;
  if (!clientId) {
    const { data: created } = await db
      .from("clients")
      .insert({ organization_id: organizationId, name: clientName.trim(), kind })
      .select("id")
      .single();
    clientId = created?.id;
  }
  if (clientId) await db.from("documents").update({ client_id: clientId }).eq("id", documentId);
}

/** Expande un ZIP en documentos hijos, listos para procesarse por separado. */
async function expandZip(db: DB, params: StageParams, buffer: Buffer) {
  const entries = await extractZipEntries(buffer);
  logger.info("zip_expanded", { documentId: params.documentId, entries: entries.length });

  for (const entry of entries) {
    const { data: child } = await db
      .from("documents")
      .insert({
        organization_id: params.organizationId,
        parent_document_id: params.documentId,
        title: entry.fileName,
        status: "subido",
        created_by: params.userId,
      })
      .select("id")
      .single();
    if (!child) continue;

    const { data: version } = await db
      .from("document_versions")
      .insert({ document_id: child.id, version: 1, created_by: params.userId })
      .select("id")
      .single();
    if (!version) continue;

    const path = `${params.organizationId}/${child.id}/1/${sanitizeStorageFileName(entry.fileName)}`;
    try {
      if (useBlobStorage()) {
        await uploadBuffer(path, entry.buffer, entry.mimeType);
      } else {
        const { error: uploadError } = await db.storage
          .from("documents")
          .upload(path, entry.buffer, { contentType: entry.mimeType });
        if (uploadError) throw new Error(uploadError.message);
      }
    } catch (uploadError) {
      // Mismo criterio que la subida directa: sin archivo, sin documento
      // huérfano. Un ZIP con una entrada problemática no debe frenar al resto.
      await db.from("documents").delete().eq("id", child.id);
      logger.warn("zip_entry_upload_failed", {
        documentId: child.id,
        entry: entry.fileName,
        error: uploadError instanceof Error ? uploadError.message : String(uploadError),
      });
      continue;
    }
    await db.from("files").insert({
      version_id: version.id,
      storage_path: path,
      file_name: entry.fileName,
      mime_type: entry.mimeType,
      size_bytes: entry.buffer.length,
      checksum_sha256: createHash("sha256").update(entry.buffer).digest("hex"),
    });
  }
}
