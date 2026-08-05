import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts, MODELS } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { extractText, extractZipEntries } from "./extraction.service";
import { chunkPages } from "./chunking.service";
import {
  classifyDocument,
  extractRequirements,
  extractTechnicalVariables,
  extractTimeline,
  summarizeDocument,
} from "./analysis.service";
import { audit } from "./audit.service";

// ============================================================================
// Pipeline de ingesta. Orquesta, para cada documento subido:
//   1. Descarga desde Storage          5. Clasificación automática
//   2. Extracción de texto (u OCR)     6. Resumen ejecutivo
//   3. Chunking                        7. Variables técnicas + requerimientos
//   4. Embeddings                      8. Línea de tiempo
// Corre con service_role en una API Route con maxDuration extendido.
// Cada paso actualiza documents.processing_step para feedback en la UI.
// ============================================================================

export interface IngestParams {
  documentId: string;
  versionId: string;
  organizationId: string;
  userId: string | null;
}

export async function processDocument(params: IngestParams): Promise<void> {
  const db = createAdminClient();
  const { documentId, versionId } = params;

  const step = async (name: string) => {
    await db.from("documents").update({ status: "procesando", processing_step: name }).eq("id", documentId);
  };

  try {
    // 1. Archivo desde Storage
    const { data: file } = await db
      .from("files")
      .select("*")
      .eq("version_id", versionId)
      .limit(1)
      .single();
    if (!file) throw new Error("Archivo no encontrado para la versión");

    const { data: blob, error: dlError } = await db.storage
      .from("documents")
      .download(file.storage_path);
    if (dlError || !blob) throw new Error(`Error descargando archivo: ${dlError?.message}`);
    const buffer = Buffer.from(await blob.arrayBuffer());

    // ZIP: expandir y crear documentos hijos, luego terminar este registro
    if (file.mime_type.includes("zip")) {
      await processZip(params, buffer);
      return;
    }

    // 2. Extracción de texto (con OCR automático si es escaneado)
    await step("extraccion_texto");
    const extracted = await extractText({
      buffer,
      mimeType: file.mime_type,
      fileName: file.file_name,
    });
    if (extracted.isScanned) await step("ocr");

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

    // 3. Chunking
    await step("chunking");
    const chunks = chunkPages(pages);

    // 4. Embeddings
    await step("embeddings");
    const embeddings = await embedTexts(chunks.map((c) => c.content));
    await db.from("document_chunks").delete().eq("version_id", versionId);
    const CHUNK_BATCH = 200;
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
      const slice = chunks.slice(i, i + CHUNK_BATCH);
      const { error } = await db.from("document_chunks").insert(
        slice.map((c, j) => ({
          document_id: documentId,
          version_id: versionId,
          chunk_index: c.index,
          content: c.content,
          page_start: c.pageStart,
          page_end: c.pageEnd,
          section: c.section,
          token_count: c.tokenCount,
          embedding: JSON.stringify(embeddings[i + j]),
        }))
      );
      if (error) throw new Error(`Error insertando chunks: ${error.message}`);
    }

    // 5. Clasificación automática → metadatos tipados + JSON completo
    await step("clasificacion");
    const classification = await classifyDocument(pages);
    await db
      .from("documents")
      .update({
        doc_type: classification.tipo_documento,
        title: classification.titulo_sugerido || undefined,
        tender_number: classification.numero_licitacion,
        tender_name: classification.nombre_licitacion,
        market_id: classification.id_mercado_publico,
        provider: classification.proveedor,
        area: classification.area,
        project_type: classification.tipo_proyecto,
        country: classification.pais,
        region: classification.region,
        city: classification.ciudad,
        doc_date: classification.fecha,
        amount: classification.monto,
        currency: classification.moneda ?? "CLP",
        contract_duration: classification.duracion_contrato,
        language: classification.idioma ?? "es",
        doc_state: classification.estado_documento,
        page_count: pages.length,
        is_scanned: extracted.isScanned,
        classification,
      })
      .eq("id", documentId);

    await maybeLinkClient(db, params.organizationId, documentId, classification.cliente, classification.tipo_cliente);

    // 6–8. Análisis profundo en paralelo (independientes entre sí)
    await step("resumen");
    const [summary, variables, requirements, timeline] = await Promise.all([
      summarizeDocument(pages),
      extractTechnicalVariables(pages),
      extractRequirements(pages),
      extractTimeline(pages),
    ]);

    await db.from("document_summaries").upsert(
      {
        document_id: documentId,
        version_id: versionId,
        summary: summary.resumen_general,
        objective: summary.objetivo,
        scope: summary.alcance,
        problems: summary.problemas_detectados,
        requirements: summary.requerimientos,
        obligations: summary.obligaciones,
        restrictions: summary.restricciones,
        risks: summary.riesgos,
        critical_points: summary.aspectos_criticos,
        deliverables: summary.entregables,
        schedule: summary.cronograma,
        recommendations: summary.recomendaciones,
        model: MODELS.chat,
      },
      { onConflict: "version_id" }
    );

    await step("variables");
    await db.from("technical_variables").delete().eq("document_id", documentId);
    if (variables.variables.length > 0) {
      await db.from("technical_variables").insert(
        variables.variables.map((v) => ({
          document_id: documentId,
          category: v.categoria,
          name: v.nombre,
          description: v.descripcion,
          value: v.valor,
          page: v.pagina,
          quote: v.cita,
          confidence: v.confianza,
        }))
      );
    }

    await db.from("requirements").delete().eq("document_id", documentId);
    if (requirements.requerimientos.length > 0) {
      await db.from("requirements").insert(
        requirements.requerimientos.map((r) => ({
          document_id: documentId,
          code: r.codigo,
          title: r.titulo,
          description: r.descripcion,
          category: r.categoria,
          mandatory: r.obligatorio,
          page: r.pagina,
          quote: r.cita,
          priority: r.prioridad,
        }))
      );
    }

    await step("timeline");
    if (timeline.hitos.length > 0) {
      await db.from("timelines").delete().eq("document_id", documentId);
      const { data: tl } = await db
        .from("timelines")
        .insert({ document_id: documentId })
        .select("id")
        .single();
      if (tl) {
        await db.from("milestones").insert(
          timeline.hitos.map((h, i) => ({
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
    }

    await db
      .from("documents")
      .update({ status: "procesado", processing_step: "completado", processing_error: null })
      .eq("id", documentId);

    await audit(params.organizationId, params.userId, "document.processed", "document", documentId, {
      pages: pages.length,
      chunks: chunks.length,
      scanned: extracted.isScanned,
    });
    logger.info("document_processed", { documentId, pages: pages.length, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("document_processing_failed", { documentId, error: message });
    await db
      .from("documents")
      .update({ status: "error", processing_error: message })
      .eq("id", documentId);
    throw err;
  }
}

/** Vincula (o crea) el cliente detectado por la clasificación. */
async function maybeLinkClient(
  db: ReturnType<typeof createAdminClient>,
  organizationId: string,
  documentId: string,
  clientName: string | null,
  kind: string | null
) {
  if (!clientName) return;
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", clientName)
    .limit(1)
    .maybeSingle();

  let clientId = existing?.id;
  if (!clientId) {
    const { data: created } = await db
      .from("clients")
      .insert({ organization_id: organizationId, name: clientName, kind })
      .select("id")
      .single();
    clientId = created?.id;
  }
  if (clientId) await db.from("documents").update({ client_id: clientId }).eq("id", documentId);
}

/** ZIP: crea un documento hijo por cada archivo soportado y lo procesa. */
async function processZip(params: IngestParams, buffer: Buffer) {
  const db = createAdminClient();
  const entries = await extractZipEntries(buffer);
  logger.info("zip_expanded", { documentId: params.documentId, entries: entries.length });

  for (const entry of entries) {
    const { data: childDoc } = await db
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
    if (!childDoc) continue;

    const { data: version } = await db
      .from("document_versions")
      .insert({ document_id: childDoc.id, version: 1, created_by: params.userId })
      .select("id")
      .single();
    if (!version) continue;

    const path = `${params.organizationId}/${childDoc.id}/1/${entry.fileName}`;
    await db.storage.from("documents").upload(path, entry.buffer, { contentType: entry.mimeType });
    await db.from("files").insert({
      version_id: version.id,
      storage_path: path,
      file_name: entry.fileName,
      mime_type: entry.mimeType,
      size_bytes: entry.buffer.length,
      checksum_sha256: createHash("sha256").update(entry.buffer).digest("hex"),
    });

    await processDocument({ ...params, documentId: childDoc.id, versionId: version.id });
  }

  await db
    .from("documents")
    .update({ status: "procesado", processing_step: "completado" })
    .eq("id", params.documentId);
}
