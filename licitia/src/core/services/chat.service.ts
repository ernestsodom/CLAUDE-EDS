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
import { getDocumentDetail } from "@/core/repositories/documents.repo";

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

/** Lista de {titulo, detalle} o strings simples, tal como las guarda
 *  document_summaries (ver SummarySchema en core/ai/schemas.ts). */
function formatItemList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  return value
    .map((item) =>
      typeof item === "string"
        ? `- ${item}`
        : `- ${(item as { titulo?: string }).titulo ?? ""}: ${(item as { detalle?: string }).detalle ?? ""}`
    )
    .join("\n");
}

/**
 * Contexto con el análisis YA PROCESADO del documento: resumen ejecutivo,
 * puntos críticos, sistemas/funcionalidades y línea de tiempo — los mismos
 * datos que se ven en las pestañas Resumen/Puntos críticos/Sistemas/Línea de
 * tiempo del documento.
 *
 * Por qué hace falta además de la búsqueda semántica (retrieve()): esa
 * búsqueda solo trae los ~12-14 fragmentos más parecidos EN TEXTO a la
 * pregunta, de entre todos los fragmentos del documento — si la pregunta usa
 * otras palabras que la cláusula original ("certificado de experiencia" vs.
 * "acreditación de experiencia del oferente"), el fragmento relevante puede
 * no quedar entre los recuperados aunque exista. El análisis ya procesado,
 * en cambio, se generó leyendo el documento COMPLETO durante la ingesta (ver
 * analysis.service.ts) y ya identificó y resumió ese punto — es una fuente
 * mucho más confiable para preguntas de "qué dice el documento sobre X".
 */
async function buildProcessedContext(
  supabase: SupabaseClient,
  documentId: string
): Promise<string> {
  const detail = await getDocumentDetail(supabase, documentId).catch(() => null);
  if (!detail) return "";

  const parts: string[] = [];
  const s = detail.summary as Record<string, unknown> | null;
  if (s) {
    const lines = [
      `RESUMEN EJECUTIVO:\n${s.summary ?? "—"}`,
      `Objetivo: ${s.objective ?? "—"}`,
      `Alcance: ${s.scope ?? "—"}`,
      `Plazo de implementación: ${s.implementation_deadline ?? "no especificado en el documento"}`,
    ];
    if (s.budget_amount != null) {
      lines.push(
        `Presupuesto: ${s.budget_amount} ${s.budget_currency ?? ""} ` +
          `(${s.budget_period ?? "sin periodicidad indicada"})` +
          (s.budget_detail ? ` — ${s.budget_detail}` : "")
      );
    }
    const criticalPoints = formatItemList(s.critical_points);
    if (criticalPoints) lines.push(`\nASPECTOS CRÍTICOS:\n${criticalPoints}`);
    const obligations = formatItemList(s.obligations);
    if (obligations) lines.push(`\nOBLIGACIONES:\n${obligations}`);
    const restrictions = formatItemList(s.restrictions);
    if (restrictions) lines.push(`\nRESTRICCIONES:\n${restrictions}`);
    const deliverables = formatItemList(s.deliverables);
    if (deliverables) lines.push(`\nENTREGABLES:\n${deliverables}`);
    parts.push(lines.join("\n"));
  }

  if (detail.requirements.length > 0) {
    const items = detail.requirements as Array<Record<string, unknown>>;
    parts.push(
      "PUNTOS CRÍTICOS (extraídos del documento completo):\n" +
        items
          .map((r) => {
            const bits = [`[${r.category ?? r.critical_type}] ${r.title}`];
            if (r.code) bits.push(`(${r.code})`);
            let line = bits.join(" ");
            if (r.description) line += `: ${r.description}`;
            if (r.deadline_text) line += ` · plazo: ${r.deadline_text}`;
            if (r.page != null) line += ` · pág. ${r.page}`;
            if (r.quote) line += ` · cita: "${r.quote}"`;
            return `- ${line}`;
          })
          .join("\n")
    );
  }

  const systems = detail.systems as Array<{
    name: string;
    deadline_text: string | null;
    features: Array<{ name: string }>;
  }>;
  if (systems.length > 0) {
    parts.push(
      "SISTEMAS Y FUNCIONALIDADES EXIGIDAS:\n" +
        systems
          .map((sys) => {
            const suffix = sys.deadline_text ? ` (plazo: ${sys.deadline_text})` : "";
            const features = sys.features.map((f) => f.name).join("; ") || "sin funcionalidades detalladas";
            return `- ${sys.name}${suffix}: ${features}`;
          })
          .join("\n")
    );
  }

  const milestones = (detail.timeline as { milestones?: Array<Record<string, unknown>> } | null)?.milestones ?? [];
  if (milestones.length > 0) {
    parts.push(
      "LÍNEA DE TIEMPO:\n" +
        milestones
          .map((m) => {
            const when = (m.duration_label as string | null) ?? (m.starts_on as string | null) ?? "sin fecha";
            return `- ${m.title}: ${when}`;
          })
          .join("\n")
    );
  }

  if (detail.deliveredItems.length > 0) {
    const items = detail.deliveredItems as Array<Record<string, unknown>>;
    parts.push(
      "ENTREGAS REGISTRADAS:\n" +
        items.map((d) => `- ${d.title}${d.delivery_state ? ` (${d.delivery_state})` : ""}`).join("\n")
    );
  }

  return parts.join("\n\n");
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

  // Groq aplica 8.000 tokens/minuto en total (entrada + salida) al modelo que
  // usa el chat — confirmado hoy en producción con el mismo motor en el
  // reanálisis de documentos. 14 fragmentos de ~800 tokens ya rozan ese
  // límite por sí solos, así que para Groq se recupera menos y se acota el
  // contexto combinado; Gemini y Claude no tienen esta restricción.
  const isGroq = engine === "groq";
  const chunks = await retrieve(supabase, question, filters, isGroq ? 6 : 14);
  const titles = await fetchDocTitles(supabase, chunks.map((c) => c.document_id));
  let context = buildRagContext(chunks, titles);

  // Cuando el chat está acotado a UN documento (el panel "Chat IA" dentro de
  // un documento), se suma el análisis ya procesado de ese documento —
  // resumen ejecutivo, puntos críticos, sistemas y línea de tiempo — que se
  // generó leyendo el documento COMPLETO durante la ingesta. La búsqueda
  // semántica por sí sola puede no traer el fragmento correcto si la
  // pregunta usa palabras distintas a las del documento; este contexto no
  // depende de eso. Ver buildProcessedContext() para el detalle.
  const documentIds = filters.documentIds ?? [];
  let processedContext =
    documentIds.length === 1 ? await buildProcessedContext(supabase, documentIds[0]) : "";

  if (isGroq) {
    const GROQ_CONTEXT_CHAR_BUDGET = 20_000;
    const GROQ_PROCESSED_CHAR_CAP = 14_000;
    // Se prioriza el análisis procesado (más denso y confiable) y se recorta
    // lo que sobre de los fragmentos RAG, nunca al revés.
    processedContext = processedContext.slice(0, GROQ_PROCESSED_CHAR_CAP);
    const remaining = Math.max(0, GROQ_CONTEXT_CHAR_BUDGET - processedContext.length);
    context = context.slice(0, remaining);
  }

  const system = `${AGENT_PROMPTS[agent]}

${
  processedContext
    ? "Tienes dos fuentes de contexto: un ANÁLISIS YA PROCESADO del documento completo (resumen, " +
      "puntos críticos, sistemas, línea de tiempo) y FRAGMENTOS recuperados por búsqueda semántica. " +
      "El análisis procesado es la fuente más confiable para preguntas sobre qué exige, contempla o " +
      "establece el documento en general — revísalo SIEMPRE antes de decir que no hay información. " +
      "Usa los fragmentos para citas textuales puntuales cuando existan; si el dato viene del análisis " +
      "procesado y no de un fragmento, igual respóndelo y cita la página si el análisis la trae, sin " +
      "inventar un chunk_id.\n"
    : ""
}Al FINAL de tu respuesta, después de la línea ${CITATION_DELIMITER}, emite un JSON:
{"citas":[{"chunk_id":"...","cita_textual":"...","pagina":N,"seccion":"..."}],"confianza":0.0-1.0}
Usa chunk_id solo cuando la cita venga de un fragmento del contexto recuperado; si viene del análisis
ya procesado, deja chunk_id como cadena vacía "".`;

  const userMessage = `${
    processedContext ? `ANÁLISIS YA PROCESADO DEL DOCUMENTO:\n${processedContext}\n\n` : ""
  }CONTEXTO RECUPERADO (fragmentos por búsqueda semántica):\n${context || "(sin resultados relevantes)"}\n\nPREGUNTA:\n${question}`;
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
  // Groq cuenta entrada + salida contra su límite de 8.000 tokens/minuto: sin
  // tope de salida, una respuesta larga puede por sí sola agotarlo incluso
  // con el contexto ya acotado arriba.
  const maxTokens = isGroq ? { max_tokens: 2_000 } : {};

  let stream: Stream<ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model,
      stream: true,
      stream_options: { include_usage: true },
      ...maxTokens,
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!UNKNOWN_PARAM_ERROR.test(message)) throw err;
    logger.warn("chat_stream_options_rejected", { engine, model, error: message });
    stream = await client.chat.completions.create({ model, stream: true, ...maxTokens, messages });
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
