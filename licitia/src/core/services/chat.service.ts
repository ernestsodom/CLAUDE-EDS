import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS, openai } from "@/lib/openai";
import { AGENT_PROMPTS, buildRagContext } from "@/core/ai/agents";
import type { AgentKind, SearchFilters } from "@/core/domain/types";
import { fetchDocTitles, retrieve } from "./rag.service";

// ============================================================================
// Chat RAG con streaming y citas.
// Estrategia de citas: el modelo responde texto libre, y al final emite un
// bloque JSON delimitado por <!--citas--> con citas + confianza, que el
// route handler separa antes de persistir el mensaje.
// ============================================================================

export const CITATION_DELIMITER = "<!--citas-->";

export interface ChatTurnInput {
  supabase: SupabaseClient;
  agent: AgentKind;
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  filters: SearchFilters;
}

export async function streamChatTurn(input: ChatTurnInput) {
  const { supabase, agent, question, history, filters } = input;

  const chunks = await retrieve(supabase, question, filters, 14);
  const titles = await fetchDocTitles(supabase, chunks.map((c) => c.document_id));
  const context = buildRagContext(chunks, titles);

  const system = `${AGENT_PROMPTS[agent]}

Al FINAL de tu respuesta, después de la línea ${CITATION_DELIMITER}, emite un JSON:
{"citas":[{"chunk_id":"...","cita_textual":"...","pagina":N,"seccion":"..."}],"confianza":0.0-1.0}
Solo incluye chunk_ids presentes en el contexto.`;

  const stream = await openai().chat.completions.create({
    model: MODELS.chat,
    stream: true,
    messages: [
      { role: "system", content: system },
      ...history.slice(-10),
      {
        role: "user",
        content: `CONTEXTO RECUPERADO:\n${context || "(sin resultados relevantes)"}\n\nPREGUNTA:\n${question}`,
      },
    ],
  });

  return { stream, retrievedChunks: chunks };
}

/** Separa el texto visible del bloque de citas emitido al final. */
export function splitAnswerAndCitations(full: string): {
  answer: string;
  citations: Array<{ chunk_id: string; cita_textual: string; pagina: number | null; seccion: string | null }>;
  confidence: number | null;
} {
  const idx = full.indexOf(CITATION_DELIMITER);
  if (idx === -1) return { answer: full.trim(), citations: [], confidence: null };

  const answer = full.slice(0, idx).trim();
  const jsonRaw = full.slice(idx + CITATION_DELIMITER.length).trim();
  try {
    const parsed = JSON.parse(jsonRaw.replace(/^```json?\s*|\s*```$/g, ""));
    return {
      answer,
      citations: Array.isArray(parsed.citas) ? parsed.citas : [],
      confidence: typeof parsed.confianza === "number" ? parsed.confianza : null,
    };
  } catch {
    return { answer, citations: [], confidence: null };
  }
}
