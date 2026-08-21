import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { anthropic, CLAUDE_MAX_TOKENS } from "@/lib/anthropic";
import {
  getProviderClient,
  isOpenAICompatible,
  isProviderConfigured,
  listConfiguredProviders,
  modelFor,
  type ProviderId,
} from "@/lib/ai-providers";
import { AGENT_PROMPTS, buildRagContext } from "@/core/ai/agents";
import type { AgentKind, SearchFilters } from "@/core/domain/types";
import { fetchDocTitles, retrieve } from "./rag.service";
import type { UsageEvent } from "./ai-usage.service";
import { logger } from "@/lib/logger";

/** Un proveedor rechazó el parámetro 'stream_options' en sí (no la
 *  petición en general): reintentar sin él es seguro. Cualquier otro error
 *  —cuota, autenticación, red— se propaga tal cual, sin reintento inútil. */
const UNKNOWN_PARAM_ERROR = /stream_options|unrecognized|unsupported|unknown.?parameter|not.?support/i;

// ============================================================================
// Chat RAG con streaming y citas.
//
// El usuario elige el motor de cada conversación (Gemini, Groq o Claude). Los
// dos primeros hablan la API de OpenAI; Claude tiene la suya. Para que el
// route handler no tenga que saber cuál se usó, streamChatTurn devuelve
// siempre lo mismo: un iterable asíncrono de fragmentos de texto.
//
// Estrategia de citas: el modelo responde texto libre y al final emite un
// bloque JSON delimitado por <!--citas--> con citas + confianza, que el route
// handler separa antes de persistir el mensaje.
// ============================================================================

export const CITATION_DELIMITER = "<!--citas-->";

/**
 * Motores del chat: los mismos proveedores que analizan documentos. El chat no
 * tiene modo local (no hay respuesta conversacional sin modelo) ni 'auto'
 * (aquí la elección es por conversación y debe ser visible), así que se queda
 * con la lista de proveedores configurados tal cual.
 */
export const CHAT_ENGINES = ["gemini", "groq", "claude"] as const;
export type ChatEngine = ProviderId;

export const CHAT_ENGINE_LABELS: Record<ChatEngine, string> = {
  gemini: "Gemini",
  groq: "Groq",
  claude: "Claude Haiku 4.5",
};

export function isChatEngineConfigured(engine: ChatEngine): boolean {
  return isProviderConfigured(engine);
}

/** Motores de chat realmente disponibles. */
export function listChatEngines(): Array<{ id: ChatEngine; label: string; isPaid: boolean }> {
  return listConfiguredProviders().map((p) => ({ id: p.id, label: p.label, isPaid: p.isPaid }));
}

export interface ChatTurnInput {
  supabase: SupabaseClient;
  agent: AgentKind;
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  filters: SearchFilters;
  engine?: ChatEngine;
  /** Se llama una vez, con los tokens reales, cuando el stream termina de
   *  emitirse por completo (ver ai-usage.service.ts). */
  onUsage?: (u: UsageEvent) => void;
}

export interface ChatTurnResult {
  /** Fragmentos de texto en el orden en que los emite el modelo. */
  textStream: AsyncIterable<string>;
  retrievedChunks: Awaited<ReturnType<typeof retrieve>>;
  engine: ChatEngine;
  model: string;
}

export async function streamChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const { supabase, agent, question, history, filters, onUsage } = input;

  const engine = input.engine ?? listChatEngines()[0]?.id ?? "gemini";
  if (!isChatEngineConfigured(engine)) {
    throw new Error(
      `El motor ${CHAT_ENGINE_LABELS[engine]} no está configurado. Elige otro en el selector del chat.`
    );
  }

  const chunks = await retrieve(supabase, question, filters, 14);
  const titles = await fetchDocTitles(supabase, chunks.map((c) => c.document_id));
  const context = buildRagContext(chunks, titles);

  const system = `${AGENT_PROMPTS[agent]}

Al FINAL de tu respuesta, después de la línea ${CITATION_DELIMITER}, emite un JSON:
{"citas":[{"chunk_id":"...","cita_textual":"...","pagina":N,"seccion":"..."}],"confianza":0.0-1.0}
Solo incluye chunk_ids presentes en el contexto.`;

  const userMessage = `CONTEXTO RECUPERADO:\n${context || "(sin resultados relevantes)"}\n\nPREGUNTA:\n${question}`;
  const turns = history.slice(-10);

  if (!isOpenAICompatible(engine)) {
    const model = modelFor(engine, "chat");
    const stream = anthropic().messages.stream({
      model,
      max_tokens: CLAUDE_MAX_TOKENS,
      system,
      messages: [...turns, { role: "user" as const, content: userMessage }],
    });

    async function* claudeText(): AsyncIterable<string> {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
      // El SDK acumula el mensaje completo mientras se consume el stream;
      // una vez que termina de iterarse, .finalMessage() resuelve al toque
      // con los tokens reales — no hay que volver a pedirle nada al modelo.
      if (onUsage) {
        const final = await stream.finalMessage();
        onUsage({
          provider: "claude",
          model,
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        });
      }
    }

    return { textStream: claudeText(), retrievedChunks: chunks, engine, model };
  }

  const model = modelFor(engine, "chat");
  const client = getProviderClient(engine);
  const messages = [
    { role: "system" as const, content: system },
    ...turns,
    { role: "user" as const, content: userMessage },
  ];

  // Pide que el último chunk del stream traiga el conteo real de tokens
  // (soportado por Groq y por la capa OpenAI-compatible de Gemini); ese
  // chunk no trae texto, solo 'usage'. Si algún proveedor cambia de
  // comportamiento y lo rechaza, NO debe tumbar el chat — se reintenta sin
  // ese parámetro y simplemente no se registra el consumo de esa respuesta.
  let stream: Stream<ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!UNKNOWN_PARAM_ERROR.test(message)) throw err;
    logger.warn("chat_stream_options_rejected", { engine, model, error: message });
    stream = await client.chat.completions.create({ model, stream: true, messages });
  }

  async function* openaiText(): AsyncIterable<string> {
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (part.usage && onUsage) {
        onUsage({
          provider: engine,
          model,
          inputTokens: part.usage.prompt_tokens ?? 0,
          outputTokens: part.usage.completion_tokens ?? 0,
        });
      }
    }
  }

  return { textStream: openaiText(), retrievedChunks: chunks, engine, model };
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
