import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts, MODELS } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { extractText, extractZipEntries } from "./extraction.service";
import { chunkPages } from "./chunking.service";
import {
  classifyDocument,
  extractDeliveredItems,
  extractRequirements,
  extractSystems,
  extractTechnicalVariables,
  extractTimeline,
  summarizeDocument,
} from "./analysis.service";
import {
  classifyDocumentLocal,
  extractDeliveredItemsLocal,
  extractRequirementsLocal,
  extractSystemsLocal,
  extractTechnicalVariablesLocal,
  extractTimelineLocal,
  summarizeLocal,
} from "./heuristic.service";
import { audit } from "./audit.service";
import type { PageText } from "@/core/domain/types";
import {
  ENGINE_LABELS,
  isProviderConfigured,
  listConfiguredProviders,
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

  if (mode === "gemini" || mode === "groq") {
    // Elección explícita: si falla, se reporta el error tal cual tal como es.
    return { data: await runWithProvider(mode), engine: mode };
  }

  // 'auto': recorre los proveedores configurados; si todos fallan por cuota,
  // continúa en el motor local. Cualquier otro tipo de error se propaga.
  const order = listConfiguredProviders().map((p) => p.id);
  for (const provider of order) {
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

// ============================================================================
// Pipeline de ingesta POR ETAPAS.
//
// Cada llamada a runNextStage() ejecuta un único tramo acotado de trabajo y
// devuelve el estado. El cliente vuelve a llamar hasta recibir done=true.
//
// Motivo del diseño: las funciones serverless tienen un límite de duración
// (60 s en el plan Hobby de Vercel) y no garantizan que el trabajo lanzado
// "en segundo plano" tras responder llegue a ejecutarse. Troceando el
// pipeline, cada etapa cabe holgadamente en el límite, el progreso es
// visible y el proceso es reanudable: si una etapa falla, se reintenta sin
// repetir las anteriores.
//
// Etapas (documents.processing_step marca la siguiente pendiente):
//   extraccion_texto → chunking → embeddings* → clasificacion → resumen
//   → variables → requerimientos → timeline → completado
//   (*) embeddings se repite en lotes mientras queden chunks sin vectorizar.
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
  chunking: "embeddings",
  embeddings: "clasificacion",
  clasificacion: "resumen",
  resumen: "variables",
  variables: "sistemas",
  sistemas: "requerimientos",
  requerimientos: "timeline",
  timeline: "completado",
};

/** Etiquetas legibles para la interfaz. */
export const STEP_LABELS: Record<string, string> = {
  extraccion_texto: "extrayendo texto",
  chunking: "dividiendo el documento",
  embeddings: "generando vectores de búsqueda",
  clasificacion: "clasificando",
  resumen: "redactando el resumen ejecutivo",
  variables: "extrayendo variables técnicas",
  sistemas: "identificando sistemas y funcionalidades",
  requerimientos: "extrayendo puntos críticos",
  timeline: "construyendo la línea de tiempo",
  completado: "completado",
};

export async function runNextStage(params: StageParams): Promise<StageResult> {
  const db = createAdminClient();
  const { documentId } = params;

  const { data: doc } = await db
    .from("documents")
    .select("id, doc_type, status, processing_step")
    .eq("id", documentId)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  const mode: AnalysisMode = params.mode ?? "auto";
  const step = doc.processing_step ?? "extraccion_texto";
  if (step === "completado") return { step: "completado", done: true };

  const { data: version } = await db
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .single();
  if (!version) throw new Error("El documento no tiene una versión activa");
  const versionId = version.id as string;

  const advance = async (to: string) => {
    const finished = to === "completado";
    await db
      .from("documents")
      .update({
        processing_step: to,
        status: finished ? "procesado" : "procesando",
        processing_error: null,
      })
      .eq("id", documentId);
  };

  try {
    switch (step) {
      case "extraccion_texto": {
        const detail = await stageExtract(db, params, versionId, mode);
        if (detail === "zip") {
          await advance("completado");
          return { step: "completado", done: true, detail: "ZIP expandido" };
        }
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "chunking": {
        const detail = await stageChunk(db, documentId, versionId);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "embeddings": {
        // Solo Gemini genera embeddings. En 'local' o 'groq' se omiten sin
        // más: la búsqueda sigue funcionando por texto completo en español.
        if (mode === "local" || mode === "groq") {
          await advance(NEXT[step]);
          return {
            step: NEXT[step],
            done: false,
            detail: `vectores omitidos (${ENGINE_LABELS[mode]} no genera embeddings; la búsqueda seguirá funcionando por texto)`,
          };
        }
        if (!isProviderConfigured(EMBEDDING_PROVIDER)) {
          await advance(NEXT[step]);
          return { step: NEXT[step], done: false, detail: "vectores omitidos (Gemini no configurado)" };
        }
        try {
          const remaining = await stageEmbedBatch(db, versionId);
          if (remaining > 0) {
            return { step: "embeddings", done: false, detail: `${remaining} fragmentos pendientes` };
          }
        } catch (err) {
          // Los vectores son una mejora (búsqueda semántica), no un requisito
          // para poder analizar el documento: ante falta de cuota se omiten
          // en cualquier modo, incluido 'gemini' explícito.
          if (!isQuotaError(err)) throw err;
          logger.warn("embeddings_skipped_quota", { documentId });
          await advance(NEXT[step]);
          return { step: NEXT[step], done: false, detail: "vectores omitidos por falta de cuota" };
        }
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false };
      }

      case "clasificacion": {
        const r = await stageClassify(db, params, versionId, mode);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail: r.detail, engine: r.engine };
      }

      case "resumen": {
        const r = await stageSummary(db, documentId, versionId, mode);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, engine: r.engine };
      }

      case "variables": {
        const r = await stageVariables(db, documentId, versionId, mode);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail: r.detail, engine: r.engine };
      }

      case "sistemas": {
        const r = await stageSystems(db, documentId, versionId, doc.doc_type, mode);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail: r.detail, engine: r.engine };
      }

      case "requerimientos": {
        const r = await stageRequirements(db, documentId, versionId, doc.doc_type, mode);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail: r.detail, engine: r.engine };
      }

      case "timeline": {
        const r = await stageTimeline(db, documentId, versionId, mode);
        await advance("completado");
        await audit(params.organizationId, params.userId, "document.processed", "document", documentId);
        logger.info("document_processed", { documentId, mode });
        return { step: "completado", done: true, detail: r.detail, engine: r.engine };
      }

      default:
        await advance("completado");
        return { step: "completado", done: true };
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

/** Ejecuta todas las etapas seguidas (para entornos sin límite estricto de duración). */
export async function processDocumentFully(params: StageParams): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await runNextStage(params);
    if (r.done) return;
  }
  throw new Error("El procesamiento superó el número máximo de etapas");
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

  const { data: blob, error } = await db.storage.from("documents").download(file.storage_path);
  if (error || !blob) throw new Error(`Error descargando el archivo: ${error?.message}`);
  const buffer = Buffer.from(await blob.arrayBuffer());

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
  const { data: c, engine } = await analyze(
    mode,
    (provider) => classifyDocument(pages, provider),
    () => classifyDocumentLocal(pages)
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
  mode: AnalysisMode
): Promise<{ engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const { data: s, engine } = await analyze(
    mode,
    (provider) => summarizeDocument(pages, provider),
    () => summarizeLocal(pages)
  );
  await db.from("document_summaries").upsert(
    {
      document_id: documentId,
      version_id: versionId,
      summary: s.resumen_general,
      objective: s.objetivo,
      scope: s.alcance,
      problems: s.problemas_detectados,
      requirements: s.requerimientos,
      obligations: s.obligaciones,
      restrictions: s.restricciones,
      risks: s.riesgos,
      critical_points: s.aspectos_criticos,
      deliverables: s.entregables,
      schedule: s.cronograma,
      recommendations: s.recomendaciones,
      model: engine === "local" ? "motor-local" : engine === "gemini" ? MODELS.chat : engine,
    },
    { onConflict: "version_id" }
  );
  return { engine };
}

async function stageVariables(
  db: DB,
  documentId: string,
  versionId: string,
  mode: AnalysisMode
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const { data: v, engine } = await analyze(
    mode,
    (provider) => extractTechnicalVariables(pages, provider),
    () => extractTechnicalVariablesLocal(pages)
  );
  await db.from("technical_variables").delete().eq("document_id", documentId);
  if (v.variables.length > 0) {
    await db.from("technical_variables").insert(
      v.variables.map((x) => ({
        document_id: documentId,
        category: x.categoria,
        name: x.nombre,
        description: x.descripcion,
        value: x.valor,
        page: x.pagina,
        quote: x.cita,
        confidence: x.confianza,
      }))
    );
  }
  return { detail: `${v.variables.length} variables${engineSuffix(engine)}`, engine };
}

/**
 * Sistemas exigidos por el documento y sus funcionalidades → el checklist.
 * Los documentos de control/avance no describen lo exigido sino lo entregado,
 * así que se saltan esta etapa.
 */
async function stageSystems(
  db: DB,
  documentId: string,
  versionId: string,
  docType: string,
  mode: AnalysisMode
): Promise<{ detail: string; engine: AnalysisMode }> {
  if (["control_entregas", "avance", "acta", "reclamo"].includes(docType)) {
    return { detail: "no aplica a este tipo de documento", engine: mode };
  }

  const pages = await loadPages(db, versionId);
  const { data: s, engine } = await analyze(
    mode,
    (provider) => extractSystems(pages, provider),
    () => extractSystemsLocal(pages)
  );

  // Borrar y reinsertar: el borrado en cascada se lleva las funcionalidades.
  // Se conserva el estado de las que el usuario ya marcó como completadas,
  // emparejándolas por nombre normalizado — reprocesar un documento no puede
  // hacerle perder al usuario el avance que ya registró a mano.
  const { data: previous } = await db
    .from("system_features")
    .select("name, is_completed, completed_at, completed_by")
    .eq("document_id", documentId)
    .eq("is_completed", true);
  const doneBefore = new Map(
    (previous ?? []).map((f) => [
      f.name.trim().toLowerCase(),
      { completed_at: f.completed_at, completed_by: f.completed_by },
    ])
  );

  await db.from("systems").delete().eq("document_id", documentId);

  let features = 0;
  for (const [i, sys] of s.sistemas.entries()) {
    const { data: created } = await db
      .from("systems")
      .insert({
        document_id: documentId,
        name: sys.nombre,
        description: sys.descripcion,
        deadline_text: sys.plazo,
        page: sys.pagina,
        quote: sys.cita,
        sort_order: i,
      })
      .select("id")
      .single();
    if (!created || sys.funcionalidades.length === 0) continue;

    const { error } = await db.from("system_features").insert(
      sys.funcionalidades.map((f, j) => {
        const kept = doneBefore.get(f.nombre.trim().toLowerCase());
        return {
          system_id: created.id,
          document_id: documentId,
          name: f.nombre,
          description: f.descripcion,
          deadline_text: f.plazo ?? sys.plazo,
          page: f.pagina,
          quote: f.cita,
          is_mandatory: f.obligatoria,
          is_completed: Boolean(kept),
          completed_at: kept?.completed_at ?? null,
          completed_by: kept?.completed_by ?? null,
          sort_order: j,
        };
      })
    );
    if (error) throw new Error(`Error guardando funcionalidades: ${error.message}`);
    features += sys.funcionalidades.length;
  }

  return {
    detail: `${s.sistemas.length} sistemas, ${features} funcionalidades${engineSuffix(engine)}`,
    engine,
  };
}

async function stageRequirements(
  db: DB,
  documentId: string,
  versionId: string,
  docType: string,
  mode: AnalysisMode
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);

  // Documentos de control/avance: se extraen las entregas realizadas
  // (incluidos trabajos adicionales y gratuitos) en lugar de requerimientos.
  if (["control_entregas", "avance", "informe", "acta"].includes(docType)) {
    const { data: d, engine } = await analyze(
      mode,
      (provider) => extractDeliveredItems(pages, provider),
      () => extractDeliveredItemsLocal(pages)
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

  const { data: r, engine } = await analyze(
    mode,
    (provider) => extractRequirements(pages, provider),
    () => extractRequirementsLocal(pages)
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
  mode: AnalysisMode
): Promise<{ detail: string; engine: AnalysisMode }> {
  const pages = await loadPages(db, versionId);
  const { data: t, engine } = await analyze(
    mode,
    (provider) => extractTimeline(pages, provider),
    () => extractTimelineLocal(pages)
  );
  if (t.hitos.length === 0) return { detail: `sin hitos${engineSuffix(engine)}`, engine };

  await db.from("timelines").delete().eq("document_id", documentId);
  const { data: tl } = await db
    .from("timelines")
    .insert({ document_id: documentId })
    .select("id")
    .single();
  if (tl) {
    await db.from("milestones").insert(
      t.hitos.map((h, i) => ({
        timeline_id: tl.id,
        milestone_type: h.tipo,
        title: h.titulo,
        description: h.descripcion,
        starts_on: h.fecha_inicio,
        ends_on: h.fecha_fin,
        duration_label: h.plazo_texto,
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

    const path = `${params.organizationId}/${child.id}/1/${entry.fileName}`;
    await db.storage.from("documents").upload(path, entry.buffer, { contentType: entry.mimeType });
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
