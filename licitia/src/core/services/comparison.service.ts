import { createAdminClient } from "@/lib/supabase/admin";
import { structuredCompletion } from "@/core/ai/structured";
import { ComplianceSchema, DiffSchema } from "@/core/ai/schemas";
import { MODELS, embedQuery } from "@/lib/openai";
import { logger } from "@/lib/logger";

// ============================================================================
// Comparador de cumplimiento: licitación (requerimientos ya extraídos)
// vs documento de avances. Por cada lote de requerimientos se recupera
// evidencia del documento destino y la IA clasifica el estado.
// También soporta comparación doc-vs-doc (diferencias).
// ============================================================================

const TRAFFIC_LIGHT = (pctFulfilled: number): "verde" | "amarillo" | "rojo" =>
  pctFulfilled >= 80 ? "verde" : pctFulfilled >= 50 ? "amarillo" : "rojo";

export async function runComplianceComparison(comparisonId: string): Promise<void> {
  const db = createAdminClient();

  const { data: cmp } = await db.from("comparisons").select("*").eq("id", comparisonId).single();
  if (!cmp) throw new Error("Comparación no encontrada");

  try {
    const { data: requirements } = await db
      .from("requirements")
      .select("*")
      .eq("document_id", cmp.source_document_id)
      .order("created_at");
    if (!requirements?.length) {
      throw new Error("El documento origen no tiene requerimientos extraídos. Procesa el documento primero.");
    }

    const items: Array<Record<string, unknown>> = [];
    const BATCH = 10;

    for (let i = 0; i < requirements.length; i += BATCH) {
      const batch = requirements.slice(i, i + BATCH);

      // Evidencia: top chunks del documento destino por similitud a cada requerimiento
      const evidenceBlocks: string[] = [];
      for (const req of batch) {
        const embedding = await embedQuery(`${req.title}. ${req.description ?? ""}`);
        const { data: evidence } = await db.rpc("match_chunks", {
          query_embedding: JSON.stringify(embedding),
          match_count: 4,
          filter_document_ids: [cmp.target_document_id],
          filter_doc_type: null,
          filter_client_id: null,
        });
        const blocks = (evidence ?? [])
          .map(
            (e: { content: string; page_start: number | null }) =>
              `  [pág. ${e.page_start ?? "?"}] ${e.content.slice(0, 800)}`
          )
          .join("\n");
        evidenceBlocks.push(
          `REQUERIMIENTO: ${req.code ?? ""} ${req.title}\n${req.description ?? ""}\nEVIDENCIA EN DOCUMENTO DE AVANCE:\n${blocks || "  (sin evidencia encontrada)"}`
        );
      }

      const result = await structuredCompletion({
        schema: ComplianceSchema,
        schemaName: "analisis_cumplimiento",
        model: MODELS.chat,
        system:
          "Eres un auditor de cumplimiento contractual. Para cada requerimiento, clasifica su estado " +
          "según la evidencia del documento de avance: cumplido, parcial, pendiente, no_aplica, " +
          "fuera_de_alcance o adicional. Sin evidencia explícita ⇒ pendiente. " +
          "Incluye cita de evidencia, página, comentario, riesgo y prioridad.",
        user: evidenceBlocks.join("\n\n=====\n\n"),
      });

      result.items.forEach((item, j) => {
        items.push({
          comparison_id: comparisonId,
          requirement_id: batch[j]?.id ?? null,
          requirement_text: item.requerimiento,
          status: item.estado,
          evidence_quote: item.evidencia_cita,
          evidence_document_id: cmp.target_document_id,
          evidence_page: item.evidencia_pagina,
          ai_comment: item.comentario,
          risk: item.riesgo,
          priority: item.prioridad,
          sort_order: i + j,
        });
      });
    }

    await db.from("comparison_items").delete().eq("comparison_id", comparisonId);
    await db.from("comparison_items").insert(items);

    const total = items.length || 1;
    const count = (status: string) => items.filter((i) => i.status === status).length;
    const pctFulfilled = (count("cumplido") / total) * 100;
    const pctPartial = (count("parcial") / total) * 100;
    const pctPending = (count("pendiente") / total) * 100;
    const pctAdditional = (count("adicional") / total) * 100;
    const pctOutOfScope = (count("fuera_de_alcance") / total) * 100;

    await db
      .from("comparisons")
      .update({
        status: "completado",
        pct_fulfilled: pctFulfilled,
        pct_partial: pctPartial,
        pct_pending: pctPending,
        pct_additional: pctAdditional,
        pct_out_of_scope: pctOutOfScope,
        traffic_light: TRAFFIC_LIGHT(pctFulfilled + pctPartial * 0.5),
        summary: `${count("cumplido")}/${total} cumplidos, ${count("parcial")} parciales, ${count("pendiente")} pendientes.`,
      })
      .eq("id", comparisonId);

    logger.info("comparison_completed", { comparisonId, total });
  } catch (err) {
    await db
      .from("comparisons")
      .update({ status: "error", summary: err instanceof Error ? err.message : String(err) })
      .eq("id", comparisonId);
    throw err;
  }
}

/** Comparación de diferencias entre dos documentos (licitaciones, propuestas, contratos o versiones). */
export async function runDiffComparison(comparisonId: string): Promise<void> {
  const db = createAdminClient();
  const { data: cmp } = await db.from("comparisons").select("*").eq("id", comparisonId).single();
  if (!cmp) throw new Error("Comparación no encontrada");

  const getText = async (documentId: string, maxChars: number) => {
    const { data: version } = await db
      .from("document_versions")
      .select("id")
      .eq("document_id", documentId)
      .eq("is_current", true)
      .single();
    if (!version) return "";
    const { data: pages } = await db
      .from("document_pages")
      .select("page_number, content")
      .eq("version_id", version.id)
      .order("page_number");
    let out = "";
    for (const p of pages ?? []) {
      const block = `\n=== PÁGINA ${p.page_number} ===\n${p.content}`;
      if (out.length + block.length > maxChars) break;
      out += block;
    }
    return out;
  };

  try {
    const [textA, textB] = await Promise.all([
      getText(cmp.source_document_id, 120_000),
      getText(cmp.target_document_id, 120_000),
    ]);

    const result = await structuredCompletion({
      schema: DiffSchema,
      schemaName: "diferencias_documentos",
      model: MODELS.chat,
      system:
        "Eres un analista legal-técnico. Compara los dos documentos e identifica todas las diferencias " +
        "relevantes: alcance, montos, plazos, requerimientos agregados/eliminados/modificados, multas, " +
        "garantías y condiciones. Evalúa el impacto de cada diferencia.",
      user: `DOCUMENTO A:\n${textA}\n\n########\n\nDOCUMENTO B:\n${textB}`,
    });

    await db
      .from("comparisons")
      .update({ status: "completado", differences: result.diferencias, summary: result.resumen })
      .eq("id", comparisonId);
  } catch (err) {
    await db
      .from("comparisons")
      .update({ status: "error", summary: err instanceof Error ? err.message : String(err) })
      .eq("id", comparisonId);
    throw err;
  }
}
