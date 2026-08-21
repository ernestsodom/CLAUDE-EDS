import { createAdminClient } from "@/lib/supabase/admin";
import { structuredCompletion } from "@/core/ai/structured";
import { ComplianceSchema, DiffSchema, type Diff } from "@/core/ai/schemas";
import { embedQuery } from "@/lib/openai";
import { isProviderId, type AnalysisMode, type ProviderId } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";
import { extractDeliveredItems } from "./analysis.service";
import { compareDocumentsLocal } from "./heuristic.service";
import { usageLogger, type UsageEvent } from "./ai-usage.service";
import type { PageText } from "@/core/domain/types";

// ============================================================================
// Comparador de cumplimiento — el corazón del control interno:
// documento base (licitación / bases técnicas / contrato) vs documento de
// control propio con lo realmente entregado.
//
// Pasada 1 (comprometido → entregado): por cada requerimiento del documento
//   base se recupera evidencia del documento de control y la IA clasifica
//   su estado (cumplido/parcial/pendiente/no_aplica/fuera_de_alcance).
// Pasada 2 (entregado → comprometido, inversa): las entregas del documento
//   de control que NO responden a ningún requerimiento del acuerdo se
//   incorporan como "adicional", distinguiendo las realizadas sin costo.
//
// También soporta comparación doc-vs-doc (diferencias).
// ============================================================================

const TRAFFIC_LIGHT = (pctFulfilled: number): "verde" | "amarillo" | "rojo" =>
  pctFulfilled >= 80 ? "verde" : pctFulfilled >= 50 ? "amarillo" : "rojo";

/**
 * Motor con el que corre la comparación. Es el que elige el usuario en la
 * pantalla; si eligió 'auto' o 'local' —modos que aquí no aplican, porque el
 * análisis de cumplimiento sí necesita un modelo— se usa Gemini, el motor
 * gratuito por defecto.
 */
function providerFor(mode: AnalysisMode | undefined): ProviderId {
  return mode && isProviderId(mode) ? mode : "gemini";
}

/** Caracteres de entrada permitidos POR DOCUMENTO en el comparador de
 *  diferencias. Groq responde "413 Request too large" muy por debajo de lo
 *  que aceptan Gemini o Claude para el mismo par de documentos — confirmado
 *  en producción con `openai/gpt-oss-120b`. Gemini y Claude toleran mucho
 *  más contexto, así que solo Groq necesita un presupuesto conservador. */
const CHAR_BUDGET_PER_DOC: Record<ProviderId, number> = {
  groq: 40_000,
  gemini: 200_000,
  claude: 150_000,
};

/** Tope de tokens de la respuesta, por proveedor. Sin esto, Claude usa el
 *  default global (CLAUDE_MAX_TOKENS = 8000) y los proveedores OpenAI-
 *  compatible usan el default del propio proveedor — insuficiente para un
 *  array de diferencias largo, que se corta a mitad de un string y deja el
 *  JSON inválido (confirmado en producción: "Unterminated string" al
 *  parsear). Groq además cuenta tokens de entrada + salida contra el mismo
 *  límite por minuto, así que su tope de salida se mantiene más bajo. */
const OUTPUT_MAX_TOKENS: Record<ProviderId, number> = {
  groq: 6_000,
  gemini: 16_000,
  claude: 16_000,
};

export async function runComplianceComparison(
  comparisonId: string,
  mode?: AnalysisMode
): Promise<void> {
  const db = createAdminClient();
  const provider = providerFor(mode);

  const { data: cmp } = await db.from("comparisons").select("*").eq("id", comparisonId).single();
  if (!cmp) throw new Error("Comparación no encontrada");
  const onUsage = usageLogger({
    organizationId: cmp.organization_id,
    documentId: cmp.source_document_id,
    userId: cmp.created_by,
    feature: "comparacion_cumplimiento",
  });

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
        provider,
        speed: "chat",
        onUsage,
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

    // Pasada inversa: entregas del documento de control que no responden a
    // ningún requerimiento del acuerdo → "adicional" (con marca de gratuito)
    const extras = await fetchAdditionalDeliveries(db, cmp.target_document_id, provider, onUsage);
    let freeCount = 0;
    for (const extra of extras) {
      if (extra.is_free) freeCount++;
      items.push({
        comparison_id: comparisonId,
        requirement_id: null,
        requirement_text: `(Adicional) ${extra.title}`,
        status: "adicional",
        evidence_quote: extra.quote,
        evidence_document_id: cmp.target_document_id,
        evidence_page: extra.page,
        ai_comment: extra.is_free
          ? "Trabajo adicional realizado SIN COSTO, no contemplado en el acuerdo. Útil como respaldo en negociaciones y respuestas a reclamos."
          : "Trabajo adicional fuera del acuerdo original.",
        risk: "bajo",
        priority: "bajo",
        sort_order: items.length,
      });
    }

    await db.from("comparison_items").delete().eq("comparison_id", comparisonId);
    await db.from("comparison_items").insert(items);

    // Porcentajes de cumplimiento sobre los requerimientos del acuerdo;
    // lo adicional se mide aparte (entregas extra / requerimientos totales)
    const reqItems = items.filter((i) => i.status !== "adicional");
    const total = reqItems.length || 1;
    const count = (status: string) => reqItems.filter((i) => i.status === status).length;
    const pctFulfilled = (count("cumplido") / total) * 100;
    const pctPartial = (count("parcial") / total) * 100;
    const pctPending = (count("pendiente") / total) * 100;
    const pctOutOfScope = (count("fuera_de_alcance") / total) * 100;
    const pctAdditional = (extras.length / total) * 100;

    const summaryParts = [
      `${count("cumplido")}/${total} requerimientos cumplidos, ${count("parcial")} parciales, ${count("pendiente")} pendientes.`,
    ];
    if (extras.length > 0) {
      summaryParts.push(
        `${extras.length} trabajos adicionales fuera de acuerdo detectados` +
          (freeCount > 0 ? ` (${freeCount} realizados sin costo).` : ".")
      );
    }

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
        summary: summaryParts.join(" "),
      })
      .eq("id", comparisonId);

    logger.info("comparison_completed", { comparisonId, total, extras: extras.length });
  } catch (err) {
    await db
      .from("comparisons")
      .update({ status: "error", summary: err instanceof Error ? err.message : String(err) })
      .eq("id", comparisonId);
    throw err;
  }
}

interface AdditionalDelivery {
  title: string;
  quote: string | null;
  page: number | null;
  is_free: boolean;
}

/**
 * Obtiene las entregas adicionales (fuera de acuerdo) del documento de control.
 * Si el documento fue procesado antes de existir delivered_items, las extrae
 * al vuelo desde sus páginas y las persiste para futuras comparaciones.
 */
async function fetchAdditionalDeliveries(
  db: ReturnType<typeof createAdminClient>,
  documentId: string,
  provider: ProviderId,
  onUsage?: (u: UsageEvent) => void
): Promise<AdditionalDelivery[]> {
  const { data: existing } = await db
    .from("delivered_items")
    .select("title, quote, page, is_free, is_additional")
    .eq("document_id", documentId);

  if (existing && existing.length > 0) {
    return existing.filter((e) => e.is_additional);
  }

  // Fallback: extraer al vuelo desde el texto del documento
  const { data: version } = await db
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .single();
  if (!version) return [];

  const { data: pages } = await db
    .from("document_pages")
    .select("page_number, content, ocr_used")
    .eq("version_id", version.id)
    .order("page_number");
  if (!pages?.length) return [];

  const pageTexts: PageText[] = pages.map((p) => ({
    pageNumber: p.page_number,
    content: p.content,
    ocrUsed: p.ocr_used,
  }));
  // Extracción al vuelo con el mismo motor que eligió el usuario para la
  // comparación: mezclar proveedores a mitad de un análisis daría resultados
  // difíciles de explicar.
  const delivered = await extractDeliveredItems(pageTexts, provider, onUsage);

  if (delivered.entregas.length > 0) {
    await db.from("delivered_items").insert(
      delivered.entregas.map((e) => ({
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

  return delivered.entregas
    .filter((e) => e.es_adicional)
    .map((e) => ({ title: e.titulo, quote: e.cita, page: e.pagina, is_free: e.es_gratuito }));
}

/** Todas las páginas de la versión actual de un documento, tal cual (sin
 *  recortar): la usan tanto el motor local (que no tiene límite de contexto
 *  porque no llama a ningún proveedor) como el anotado para IA. */
async function getPages(db: ReturnType<typeof createAdminClient>, documentId: string): Promise<PageText[]> {
  const { data: version } = await db
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .single();
  if (!version) return [];
  const { data: pages } = await db
    .from("document_pages")
    .select("page_number, content, ocr_used")
    .eq("version_id", version.id)
    .order("page_number");
  return (pages ?? []).map((p) => ({
    pageNumber: p.page_number,
    content: p.content,
    ocrUsed: p.ocr_used,
  }));
}

/** Texto anotado por página, hasta maxChars, para el prompt de IA. Informa
 *  si tuvo que cortar antes del final para poder avisarlo — un documento
 *  truncado a mitad no debe hacer pasar por "sin diferencias" lo que en
 *  realidad no se leyó. El motor local no usa esto: no tiene ese límite. */
function annotatePages(pages: PageText[], maxChars: number) {
  let out = "";
  let included = 0;
  for (const p of pages) {
    const block = `\n=== PÁGINA ${p.pageNumber} ===\n${p.content}`;
    if (out.length + block.length > maxChars) break;
    out += block;
    included++;
  }
  return { text: out, truncated: included < pages.length, totalPages: pages.length, includedPages: included };
}

/**
 * Comparación de diferencias entre dos documentos (licitaciones, propuestas,
 * contratos o versiones). mode === "local" corre el motor sin IA
 * (compareDocumentsLocal, diff léxico exacto); cualquier otro modo usa el
 * proveedor elegido.
 */
export async function runDiffComparison(
  comparisonId: string,
  mode?: AnalysisMode
): Promise<void> {
  const db = createAdminClient();
  const { data: cmp } = await db.from("comparisons").select("*").eq("id", comparisonId).single();
  if (!cmp) throw new Error("Comparación no encontrada");

  try {
    const [pagesA, pagesB] = await Promise.all([
      getPages(db, cmp.source_document_id),
      getPages(db, cmp.target_document_id),
    ]);

    let result: Diff;
    const extraSummaryPoints: string[] = [];

    if (mode === "local") {
      // Motor local: diff léxico exacto, sin llamar a Gemini, Groq ni
      // Claude. Instantáneo y sin límite de tamaño de documento.
      result = compareDocumentsLocal(pagesA, pagesB);
    } else {
      const provider = providerFor(mode);
      const onUsage = usageLogger({
        organizationId: cmp.organization_id,
        documentId: cmp.source_document_id,
        userId: cmp.created_by,
        feature: "comparacion_diff",
      });

      // El presupuesto de caracteres de ENTRADA y el tope de tokens de SALIDA
      // dependen del proveedor: Groq rechaza con "413 Request too large" muy
      // por debajo de lo que aceptan Gemini o Claude, y una respuesta con un
      // array de diferencias largo se corta a mitad de un string si no se fija
      // un max_tokens explícito generoso (confirmado en producción: 413 en
      // Groq y "Unterminated string" al parsear JSON truncado). Se avisa
      // explícitamente si aun así hubo que truncar el documento de entrada.
      const charBudget = CHAR_BUDGET_PER_DOC[provider];
      const a = annotatePages(pagesA, charBudget);
      const b = annotatePages(pagesB, charBudget);

      result = await structuredCompletion({
        schema: DiffSchema,
        schemaName: "diferencias_documentos",
        provider,
        speed: "chat",
        onUsage,
        maxTokens: OUTPUT_MAX_TOKENS[provider],
        system:
          "Eres un analista legal-técnico especializado en detectar diferencias entre dos versiones de un " +
          "MISMO tipo de documento (dos licitaciones, dos propuestas, dos contratos, o dos versiones) que " +
          "deberían ser muy parecidas entre sí — no documentos de naturaleza distinta. Tu tarea NO es " +
          "resumir cada documento por separado: es encontrar, punto por punto, todo lo que cambió de uno " +
          "al otro.\n" +
          "Sé exhaustivo y granular. Revisa cláusula por cláusula, sección por sección. Cada cambio " +
          "concreto es un ítem separado en 'diferencias' — nunca agrupes varios cambios distintos bajo un " +
          "solo tema genérico ('Condiciones generales', 'Requisitos'). Reporta explícitamente: montos y " +
          "cifras que cambiaron (aunque sea en un decimal o porcentaje), fechas y plazos modificados, " +
          "cláusulas o requisitos agregados, cláusulas o requisitos eliminados, redacciones que cambian el " +
          "sentido u obligación aunque las palabras se parezcan, boletas de garantía, multas y SLA, y " +
          "cualquier sección presente en un documento y ausente en el otro. Ignora diferencias irrelevantes " +
          "de formato, numeración de página o ruido de OCR que no cambian el contenido.\n" +
          "Para cada diferencia:\n" +
          "- seccion: el punto/cláusula/artículo tal como está numerado o titulado en el documento (p.ej. " +
          "'Cláusula 8.3', 'Punto 4.2 — Garantías'); si el documento no numera secciones, usa el título del " +
          "apartado más cercano.\n" +
          "- documento_a / documento_b: cita o paráfrasis puntual de ESE contenido específico en cada " +
          "documento (nunca una descripción genérica del documento completo), en pocas líneas — sin " +
          "transcribir párrafos completos.\n" +
          "- pagina_a / pagina_b: la página exacta, marcada en el texto con '=== PÁGINA N ==='; null solo " +
          "si el contenido de verdad no aparece en ese documento.\n" +
          "Reporta como máximo las 40 diferencias más relevantes — si hay más, prioriza primero impacto " +
          "alto, luego medio, y agrupa el resto en 'resumen_puntos'. La respuesta debe ser compacta: " +
          "prefiere paráfrasis breve a cita textual larga.\n" +
          "Entrega también dos niveles de lectura antes del detalle:\n" +
          "1. resumen: párrafo breve (3-6 líneas) de las diferencias más relevantes en conjunto.\n" +
          "2. resumen_puntos: 3 a 8 viñetas cortas con los cambios macro más importantes — la vista rápida " +
          "antes de entrar al detalle punto por punto de 'diferencias'.",
        user: `DOCUMENTO A:\n${a.text}\n\n########\n\nDOCUMENTO B:\n${b.text}`,
      });

      if (a.truncated) {
        extraSummaryPoints.push(
          `⚠ Documento A: solo se analizaron las primeras ${a.includedPages} de ${a.totalPages} páginas por tamaño — puede haber diferencias más allá de esa página no detectadas.`
        );
      }
      if (b.truncated) {
        extraSummaryPoints.push(
          `⚠ Documento B: solo se analizaron las primeras ${b.includedPages} de ${b.totalPages} páginas por tamaño — puede haber diferencias más allá de esa página no detectadas.`
        );
      }
    }

    const summaryPoints = [...extraSummaryPoints, ...result.resumen_puntos];

    await db
      .from("comparisons")
      .update({
        status: "completado",
        differences: result.diferencias,
        summary: result.resumen,
        summary_points: summaryPoints,
      })
      .eq("id", comparisonId);
  } catch (err) {
    await db
      .from("comparisons")
      .update({ status: "error", summary: err instanceof Error ? err.message : String(err) })
      .eq("id", comparisonId);
    throw err;
  }
}
