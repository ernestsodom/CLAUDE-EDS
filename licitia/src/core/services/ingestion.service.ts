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
  extractTechnicalVariables,
  extractTimeline,
  summarizeDocument,
} from "./analysis.service";
import { audit } from "./audit.service";
import type { PageText } from "@/core/domain/types";

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

export interface StageParams {
  documentId: string;
  organizationId: string;
  userId: string | null;
}

export interface StageResult {
  step: string;
  done: boolean;
  detail?: string;
}

const NEXT: Record<string, string> = {
  extraccion_texto: "chunking",
  chunking: "embeddings",
  embeddings: "clasificacion",
  clasificacion: "resumen",
  resumen: "variables",
  variables: "requerimientos",
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
  requerimientos: "extrayendo requerimientos",
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
        const detail = await stageExtract(db, params, versionId);
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
        const remaining = await stageEmbedBatch(db, versionId);
        if (remaining > 0) {
          return { step: "embeddings", done: false, detail: `${remaining} fragmentos pendientes` };
        }
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false };
      }

      case "clasificacion": {
        const detail = await stageClassify(db, params, versionId);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "resumen": {
        await stageSummary(db, documentId, versionId);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false };
      }

      case "variables": {
        const detail = await stageVariables(db, documentId, versionId);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "requerimientos": {
        const detail = await stageRequirements(db, documentId, versionId, doc.doc_type);
        await advance(NEXT[step]);
        return { step: NEXT[step], done: false, detail };
      }

      case "timeline": {
        const detail = await stageTimeline(db, documentId, versionId);
        await advance("completado");
        await audit(params.organizationId, params.userId, "document.processed", "document", documentId);
        logger.info("document_processed", { documentId });
        return { step: "completado", done: true, detail };
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

async function stageExtract(db: DB, params: StageParams, versionId: string): Promise<string> {
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

  const extracted = await extractText({
    buffer,
    mimeType: file.mime_type,
    fileName: file.file_name,
  });
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

/** Vectoriza un lote y devuelve cuántos quedan pendientes. */
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

async function stageClassify(db: DB, params: StageParams, versionId: string): Promise<string> {
  const pages = await loadPages(db, versionId);
  const c = await classifyDocument(pages);

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
      classification: c,
      ...(c.titulo_sugerido ? { title: c.titulo_sugerido } : {}),
    })
    .eq("id", params.documentId);

  await linkClient(db, params.organizationId, params.documentId, c.cliente, c.tipo_cliente);
  return c.tipo_documento.replace(/_/g, " ");
}

async function stageSummary(db: DB, documentId: string, versionId: string) {
  const pages = await loadPages(db, versionId);
  const s = await summarizeDocument(pages);
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
      model: MODELS.chat,
    },
    { onConflict: "version_id" }
  );
}

async function stageVariables(db: DB, documentId: string, versionId: string): Promise<string> {
  const pages = await loadPages(db, versionId);
  const v = await extractTechnicalVariables(pages);
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
  return `${v.variables.length} variables`;
}

async function stageRequirements(
  db: DB,
  documentId: string,
  versionId: string,
  docType: string
): Promise<string> {
  const pages = await loadPages(db, versionId);

  // Documentos de control/avance: se extraen las entregas realizadas
  // (incluidos trabajos adicionales y gratuitos) en lugar de requerimientos.
  if (["control_entregas", "avance", "informe", "acta"].includes(docType)) {
    const d = await extractDeliveredItems(pages);
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
    return `${d.entregas.length} entregas`;
  }

  const r = await extractRequirements(pages);
  await db.from("requirements").delete().eq("document_id", documentId);
  if (r.requerimientos.length > 0) {
    await db.from("requirements").insert(
      r.requerimientos.map((x) => ({
        document_id: documentId,
        code: x.codigo,
        title: x.titulo,
        description: x.descripcion,
        category: x.categoria,
        mandatory: x.obligatorio,
        page: x.pagina,
        quote: x.cita,
        priority: x.prioridad,
      }))
    );
  }
  return `${r.requerimientos.length} requerimientos`;
}

async function stageTimeline(db: DB, documentId: string, versionId: string): Promise<string> {
  const pages = await loadPages(db, versionId);
  const t = await extractTimeline(pages);
  if (t.hitos.length === 0) return "sin hitos";

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
  return `${t.hitos.length} hitos`;
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
