import type { SupabaseClient } from "@supabase/supabase-js";
import { structuredCompletion, textCompletion } from "@/core/ai/structured";
import { ClaimAnalysisSchema, type ClaimAnalysis } from "@/core/ai/schemas";
import { isProviderId, modelFor, type AnalysisMode, type ProviderId } from "@/lib/ai-providers";
import { AGENT_PROMPTS, buildRagContext } from "@/core/ai/agents";
import { fetchDocTitles, retrieve } from "./rag.service";
import type { Citation } from "@/core/domain/types";

// ============================================================================
// Módulo de reclamos: análisis estructurado del correo + redacción de
// respuesta profesional fundada en evidencia contractual (RAG sobre
// contrato, licitación, avances e histórico del cliente).
// ============================================================================

/**
 * Motor con el que corre el análisis del reclamo. 'auto' y 'local' no aplican
 * aquí —un reclamo se contrasta contra la evidencia con un modelo, no con
 * patrones—, así que se resuelven a Gemini, el gratuito por defecto.
 */
export function claimProviderFor(mode: AnalysisMode | undefined): ProviderId {
  return mode && isProviderId(mode) ? mode : "gemini";
}

export async function analyzeClaim(
  supabase: SupabaseClient,
  rawEmail: string,
  clientId: string | null,
  provider: ProviderId = "gemini"
): Promise<{ analysis: ClaimAnalysis; evidence: Awaited<ReturnType<typeof retrieve>> }> {
  // Evidencia relevante de toda la biblioteca autorizada (filtrada por cliente si se conoce)
  const evidence = await retrieve(
    supabase,
    rawEmail.slice(0, 2000),
    clientId ? { clientId } : {},
    16
  );
  const titles = await fetchDocTitles(supabase, evidence.map((e) => e.document_id));
  const context = buildRagContext(evidence, titles);

  const analysis = await structuredCompletion({
    schema: ClaimAnalysisSchema,
    schemaName: "analisis_reclamo",
    provider,
    speed: "chat",
    system:
      "Eres un analista de contratos. Analiza el reclamo del cliente contrastándolo con la evidencia " +
      "documental: qué reclama, qué solicita, qué contrato aplica, qué requerimientos corresponden, " +
      "qué ya fue entregado, qué está pendiente, qué está fuera del contrato, qué mejoras adicionales " +
      "se hicieron y qué riesgos existen. Basa cada conclusión SOLO en la evidencia; si no hay " +
      "evidencia suficiente sobre un punto, indícalo.",
    user: `RECLAMO DEL CLIENTE:\n${rawEmail}\n\nEVIDENCIA DOCUMENTAL:\n${context || "(sin evidencia recuperada)"}`,
  });

  return { analysis, evidence };
}

export async function draftClaimResponse(
  supabase: SupabaseClient,
  rawEmail: string,
  analysis: ClaimAnalysis,
  clientId: string | null,
  provider: ProviderId = "gemini"
): Promise<{ content: string; citations: Citation[]; model: string }> {
  const evidence = await retrieve(
    supabase,
    `${analysis.que_reclama} ${analysis.que_solicita} ${analysis.requerimientos_relacionados.join(" ")}`.slice(0, 2000),
    clientId ? { clientId } : {},
    16
  );
  const titles = await fetchDocTitles(supabase, evidence.map((e) => e.document_id));
  const context = buildRagContext(evidence, titles);

  const content = await textCompletion({
    provider,
    speed: "chat",
    system: AGENT_PROMPTS.reclamos,
    user:
      `RECLAMO ORIGINAL:\n${rawEmail}\n\n` +
      `ANÁLISIS ESTRUCTURADO:\n${JSON.stringify(analysis, null, 2)}\n\n` +
      `EVIDENCIA DOCUMENTAL:\n${context}\n\n` +
      "Redacta la respuesta profesional al cliente. Formato carta formal en español, " +
      "con referencias a cláusulas/páginas específicas de la evidencia entre paréntesis. " +
      "No prometas nada que no esté respaldado por la evidencia.",
  });
  const citations: Citation[] = evidence.map((e) => ({
    chunk_id: e.chunk_id,
    document_id: e.document_id,
    page: e.page_start,
    section: e.section,
    quote: e.content.slice(0, 200),
  }));

  return { content, citations, model: modelFor(provider, "chat") };
}
