import OpenAI from "openai";
import { env } from "@/lib/env";

// ============================================================================
// Registro de proveedores de IA compatibles con la API de OpenAI.
//
// LicitIA no depende de un único proveedor: cada tarea de análisis puede
// elegir explícitamente qué motor usar. Hoy hay dos proveedores de IA
// (ambos con nivel gratuito) más el motor local sin IA (heuristic.service.ts):
//
//   'gemini' → Google Gemini, vía su capa compatible con OpenAI.
//              Único proveedor con embeddings y OCR de PDFs escaneados.
//   'groq'   → Groq (Llama), inferencia muy rápida y nivel gratuito generoso.
//              Sin embeddings ni OCR: solo para clasificar/resumir/extraer.
//
// Añadir un tercer proveedor es cuestión de sumar una entrada a REGISTRY y
// sus variables de entorno — el resto del sistema (structuredCompletion,
// analysis.service, ingestion.service) ya es genérico sobre ProviderId.
// ============================================================================

export type ProviderId = "gemini" | "groq" | "claude";

/** Modo de análisis que puede elegir el usuario para cada documento. */
export type AnalysisMode = ProviderId | "local" | "auto";

/**
 * Claude no habla la API de OpenAI: se usa con su SDK oficial. El resto del
 * sistema decide por aquí qué camino tomar, en vez de comparar contra el
 * literal "claude" repartido por todas partes.
 */
export function isOpenAICompatible(id: ProviderId): boolean {
  return id !== "claude";
}

export function isProviderId(mode: AnalysisMode): mode is ProviderId {
  return mode !== "local" && mode !== "auto";
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  chatModel: string;
  fastModel: string;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  supportsEmbeddings: boolean;
  supportsFiles: boolean; // Files API, usada para OCR de PDFs escaneados
  isPaid: boolean; // se cobra por uso desde el primer token
}

const META: Record<
  ProviderId,
  { label: string; supportsEmbeddings: boolean; supportsFiles: boolean; isPaid: boolean }
> = {
  gemini: { label: "Gemini", supportsEmbeddings: true, supportsFiles: true, isPaid: false },
  groq: { label: "Groq", supportsEmbeddings: false, supportsFiles: false, isPaid: false },
  claude: { label: "Claude Haiku 4.5", supportsEmbeddings: false, supportsFiles: false, isPaid: true },
};

/**
 * Orden de preferencia para el modo 'auto'.
 *
 * Claude queda DELIBERADAMENTE fuera: 'auto' salta de proveedor cuando se
 * agota una cuota gratuita, y encadenar ahí un proveedor de pago gastaría
 * dinero del usuario sin que él lo haya pedido. Claude solo se usa cuando se
 * elige a mano.
 */
export const PROVIDER_ORDER: ProviderId[] = ["gemini", "groq"];

export const ENGINE_LABELS: Record<AnalysisMode, string> = {
  gemini: "Gemini",
  groq: "Groq",
  claude: "Claude Haiku 4.5",
  local: "modo local",
  auto: "automático",
};

function apiKeyFor(id: ProviderId): string | undefined {
  const e = env();
  if (id === "gemini") return e.OPENAI_API_KEY;
  if (id === "groq") return e.GROQ_API_KEY;
  return e.ANTHROPIC_API_KEY;
}

function baseURLFor(id: ProviderId): string | undefined {
  const e = env();
  return id === "gemini" ? e.OPENAI_BASE_URL : e.GROQ_BASE_URL;
}

export function isProviderConfigured(id: ProviderId): boolean {
  return Boolean(apiKeyFor(id));
}

/** Datos del proveedor (modelos, capacidades) o null si no tiene API key configurada. */
export function getProviderInfo(id: ProviderId): ProviderInfo | null {
  if (!isProviderConfigured(id)) return null;
  const e = env();
  const meta = META[id];
  const common = {
    id,
    label: meta.label,
    supportsEmbeddings: meta.supportsEmbeddings,
    supportsFiles: meta.supportsFiles,
    isPaid: meta.isPaid,
  };

  if (id === "gemini") {
    return {
      ...common,
      chatModel: e.OPENAI_CHAT_MODEL,
      fastModel: e.OPENAI_FAST_MODEL,
      embeddingModel: e.OPENAI_EMBEDDING_MODEL,
      embeddingDimensions: e.OPENAI_EMBEDDING_DIMENSIONS ?? null,
    };
  }
  if (id === "groq") {
    return {
      ...common,
      chatModel: e.GROQ_CHAT_MODEL,
      fastModel: e.GROQ_FAST_MODEL,
      embeddingModel: null,
      embeddingDimensions: null,
    };
  }
  // Claude: un único modelo para ambos niveles. Haiku 4.5 ya es el más
  // económico de la familia, así que no hay un "fast" más barato al que caer.
  return {
    ...common,
    chatModel: e.ANTHROPIC_CHAT_MODEL,
    fastModel: e.ANTHROPIC_CHAT_MODEL,
    embeddingModel: null,
    embeddingDimensions: null,
  };
}

/** Todos los proveedores conocidos, configurados o no (para diagnóstico/UI). */
export const ALL_PROVIDERS: ProviderId[] = ["gemini", "groq", "claude"];

/**
 * Proveedores con API key configurada, para ofrecérselos al usuario.
 * Incluye los de pago: PROVIDER_ORDER (la cadena de 'auto') es una lista
 * distinta y más corta a propósito — poder elegir Claude no significa que
 * 'auto' vaya a gastarlo por su cuenta.
 */
export function listConfiguredProviders(): ProviderInfo[] {
  return ALL_PROVIDERS.map(getProviderInfo).filter((p): p is ProviderInfo => p !== null);
}

/** Proveedores que 'auto' puede encadenar (solo los de cuota gratuita). */
export function listAutoProviders(): ProviderId[] {
  return PROVIDER_ORDER.filter(isProviderConfigured);
}

const clients = new Map<ProviderId, OpenAI>();

/** Cliente OpenAI apuntando al proveedor indicado. Lanza un error claro si falta la API key. */
export function getProviderClient(id: ProviderId): OpenAI {
  if (!isOpenAICompatible(id)) {
    // Guardia de programación: Claude tiene su propio cliente (lib/anthropic.ts)
    // y quien llegue aquí con "claude" olvidó ramificar antes.
    throw new Error(
      `${META[id].label} no usa la API de OpenAI: emplea su SDK oficial (lib/anthropic.ts).`
    );
  }
  const cached = clients.get(id);
  if (cached) return cached;

  const apiKey = apiKeyFor(id);
  if (!apiKey) {
    throw new Error(
      `El proveedor ${META[id].label} no está configurado (falta la API key). ` +
        `Elige otro motor o configura la variable de entorno correspondiente.`
    );
  }
  const client = new OpenAI({ apiKey, baseURL: baseURLFor(id) });
  clients.set(id, client);
  return client;
}

/** Modelo a usar según el nivel de velocidad/calidad pedido. */
export function modelFor(id: ProviderId, speed: "fast" | "chat"): string {
  const info = getProviderInfo(id);
  if (!info) throw new Error(`El proveedor ${META[id].label} no está configurado.`);
  return speed === "fast" ? info.fastModel : info.chatModel;
}

/** Genera embeddings con el proveedor indicado. Lanza si el proveedor no los ofrece. */
export async function embedWithProvider(id: ProviderId, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const info = getProviderInfo(id);
  if (!info || !info.supportsEmbeddings || !info.embeddingModel) {
    throw new Error(`El proveedor ${META[id].label} no ofrece generación de embeddings.`);
  }
  const client = getProviderClient(id);
  const BATCH = 100;
  const result: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 32000));
    const res = await client.embeddings.create({
      model: info.embeddingModel,
      input: batch,
      ...(info.embeddingDimensions ? { dimensions: info.embeddingDimensions } : {}),
    });
    for (const item of res.data) result.push(item.embedding);
  }
  return result;
}
