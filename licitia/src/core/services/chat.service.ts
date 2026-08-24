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
import { wordOverlap } from "@/lib/text-match";

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
 * Motores del chat: los mismos proveedores que analizan documentos, más
 * "local" — búsqueda léxica pura (full text en español + coincidencia por
 * palabras contra el análisis ya procesado), sin llamar a ningún proveedor
 * de IA. No hay 'auto' (aquí la elección es por conversación y debe ser
 * visible), así que además de "local" se queda con los proveedores
 * configurados tal cual.
 */
export const CHAT_ENGINES = ["gemini", "groq", "claude", "local"] as const;
export type ChatEngine = ProviderId | "local";

export const CHAT_ENGINE_LABELS: Record<ChatEngine, string> = {
  gemini: "Gemini",
  groq: "Groq",
  claude: "Claude Haiku 4.5",
  local: "Sin IA",
};

export function isChatEngineConfigured(engine: ChatEngine): boolean {
  // "local" no depende de ninguna API key: siempre está disponible.
  return engine === "local" ? true : isProviderConfigured(engine);
}

/** Motores de chat realmente disponibles. */
export function listChatEngines(): Array<{ id: ChatEngine; label: string; isPaid: boolean }> {
  return [
    ...listConfiguredProviders().map((p) => ({ id: p.id as ChatEngine, label: p.label, isPaid: p.isPaid })),
    { id: "local" as ChatEngine, label: CHAT_ENGINE_LABELS.local, isPaid: false },
  ];
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

interface LocalMatch {
  kind: string;
  text: string;
  page: number | null;
}

/** Busca coincidencias por palabras contra el análisis YA PROCESADO de un
 *  documento (mismo texto que buildProcessedContext, ver arriba) — sin IA,
 *  solo comparación léxica (wordOverlap). Es la mitad "estructurada" de la
 *  respuesta local; search_chunks_text (SQL) aporta la otra mitad, sobre el
 *  texto crudo del documento. */
function localProcessedMatches(
  detail: Awaited<ReturnType<typeof getDocumentDetail>>,
  question: string
): LocalMatch[] {
  const results: LocalMatch[] = [];
  const push = (kind: string, text: string, page: number | null, minScore = 0.15) => {
    if (text && wordOverlap(question, text) >= minScore) results.push({ kind, text, page });
  };
  const pushList = (value: unknown, kind: string) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      const text =
        typeof item === "string"
          ? item
          : `${(item as { titulo?: string }).titulo ?? ""}: ${(item as { detalle?: string }).detalle ?? ""}`;
      push(kind, text, null);
    }
  };

  const s = detail.summary as Record<string, unknown> | null;
  if (s) {
    push("Resumen", String(s.summary ?? ""), null, 0.1);
    pushList(s.critical_points, "Aspecto crítico");
    pushList(s.obligations, "Obligación");
    pushList(s.restrictions, "Restricción");
    pushList(s.deliverables, "Entregable");
  }

  for (const r of detail.requirements as Array<Record<string, unknown>>) {
    const text = `${r.title}${r.description ? `: ${r.description}` : ""}`;
    push(`Punto crítico (${r.category ?? r.critical_type})`, text, (r.page as number | null) ?? null);
  }

  const systems = detail.systems as Array<{
    name: string;
    features: Array<{ name: string }>;
  }>;
  for (const sys of systems) {
    push("Sistema", sys.name, null);
    for (const f of sys.features) push(`Funcionalidad (${sys.name})`, f.name, null, 0.25);
  }

  const milestones =
    (detail.timeline as { milestones?: Array<Record<string, unknown>> } | null)?.milestones ?? [];
  for (const m of milestones) {
    push("Hito", String(m.title ?? ""), (m.page as number | null) ?? null);
  }

  return results.sort((a, b) => wordOverlap(question, b.text) - wordOverlap(question, a.text)).slice(0, 8);
}

/**
 * Motor de chat "Sin IA": búsqueda léxica pura (full text en español vía
 * search_chunks_text — sin embeddings, sin llamar a ningún proveedor) sobre
 * los fragmentos del documento, más coincidencia por palabras contra el
 * análisis ya procesado cuando el chat está acotado a un documento. No hay
 * generación de lenguaje: la "respuesta" es literalmente lo que se
 * encontró, tal cual, con su página de origen — cero riesgo de invención,
 * pero también sin capacidad de razonar, resumir o responder preguntas que
 * no calcen con las palabras del documento.
 */
async function localChatAnswer(
  supabase: SupabaseClient,
  question: string,
  filters: SearchFilters
): Promise<string> {
  const documentIds = filters.documentIds ?? [];

  const [{ data: hits, error }, detail] = await Promise.all([
    supabase.rpc("search_chunks_text", {
      query_text: question,
      match_count: 10,
      filter_document_ids: documentIds.length ? documentIds : null,
      filter_doc_type: filters.docType ?? null,
      filter_client_id: filters.clientId ?? null,
    }),
    documentIds.length === 1 ? getDocumentDetail(supabase, documentIds[0]).catch(() => null) : null,
  ]);
  if (error) throw new Error(`Error en búsqueda local: ${error.message}`);

  const chunkHits = (hits ?? []) as Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    page_start: number | null;
    page_end: number | null;
    section: string | null;
    rank: number;
  }>;
  const processedHits = detail ? localProcessedMatches(detail, question) : [];

  const citations: Array<{ chunk_id: string; cita_textual: string; pagina: number | null; seccion: string | null }> =
    [];
  const lines: string[] = [];

  if (processedHits.length > 0) {
    lines.push("**Del análisis ya procesado del documento:**");
    for (const h of processedHits) {
      lines.push(`- [${h.kind}] ${h.text}${h.page != null ? ` (pág. ${h.page})` : ""}`);
      citations.push({ chunk_id: "", cita_textual: h.text.slice(0, 200), pagina: h.page, seccion: h.kind });
    }
  }

  if (chunkHits.length > 0) {
    const titles = await fetchDocTitles(supabase, chunkHits.map((c) => c.document_id));
    if (lines.length > 0) lines.push("");
    lines.push("**Fragmentos del documento que coinciden con tu pregunta:**");
    for (const c of chunkHits) {
      const docTitle = titles.get(c.document_id);
      const pageLabel =
        c.page_start != null ? `pág. ${c.page_start}${c.page_end && c.page_end !== c.page_start ? `–${c.page_end}` : ""}` : "";
      const label = [docTitle, c.section, pageLabel].filter(Boolean).join(" · ");
      const quote = c.content.trim().slice(0, 400) + (c.content.length > 400 ? "…" : "");
      lines.push(`- ${label ? `${label}\n  ` : ""}"${quote}"`);
      citations.push({ chunk_id: c.chunk_id, cita_textual: quote.slice(0, 200), pagina: c.page_start, seccion: c.section });
    }
  }

  if (lines.length === 0) {
    lines.push(
      "No se encontraron coincidencias literales para esa pregunta. La búsqueda local busca palabras " +
        "exactas del documento, no significado — prueba con otros términos, o cambia a un motor con IA " +
        "en el selector de arriba para una búsqueda que entienda sinónimos y contexto."
    );
  }

  const answer = lines.join("\n");
  const citationsJson = JSON.stringify({ citas: citations, confianza: null });
  return `${answer}\n\n${CITATION_DELIMITER}\n${citationsJson}`;
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

  // "Sin IA": ni RAG semántico (usa embeddings) ni ningún proveedor — se
  // resuelve aparte y se corta acá. onUsage no se llama: no hay consumo que
  // registrar.
  if (engine === "local") {
    const full = await localChatAnswer(supabase, question, filters);
    async function* localText(): AsyncIterable<string> {
      yield full;
    }
    return { textStream: localText(), retrievedChunks: [], engine, model: "motor-local" };
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
          // engine ya no puede ser "local" acá: ese caso retorna antes.
          provider: engine as ProviderId,
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
