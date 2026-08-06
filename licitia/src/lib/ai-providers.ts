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

export type ProviderId = "gemini" | "groq";

/** Modo de análisis que puede elegir el usuario para cada documento. */
export type AnalysisMode = ProviderId | "local" | "auto";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  chatModel: string;
  fastModel: string;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  supportsEmbeddings: boolean;
  supportsFiles: boolean; // Files API, usada para OCR de PDFs escaneados
}

const META: Record<ProviderId, { label: string; supportsEmbeddings: boolean; supportsFiles: boolean }> = {
  gemini: { label: "Gemini", supportsEmbeddings: true, supportsFiles: true },
  groq: { label: "Groq", supportsEmbeddings: false, supportsFiles: false },
};

/** Orden de preferencia para el modo 'auto'. */
export const PROVIDER_ORDER: ProviderId[] = ["gemini", "groq"];

export const ENGINE_LABELS: Record<AnalysisMode, string> = {
  gemini: "Gemini",
  groq: "Groq",
  local: "modo local",
  auto: "automático",
};

function apiKeyFor(id: ProviderId): string | undefined {
  const e = env();
  return id === "gemini" ? e.OPENAI_API_KEY : e.GROQ_API_KEY;
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
  if (id === "gemini") {
    return {
      id,
      label: meta.label,
      chatModel: e.OPENAI_CHAT_MODEL,
      fastModel: e.OPENAI_FAST_MODEL,
      embeddingModel: e.OPENAI_EMBEDDING_MODEL,
      embeddingDimensions: e.OPENAI_EMBEDDING_DIMENSIONS ?? null,
      supportsEmbeddings: meta.supportsEmbeddings,
      supportsFiles: meta.supportsFiles,
    };
  }
  return {
    id,
    label: meta.label,
    chatModel: e.GROQ_CHAT_MODEL,
    fastModel: e.GROQ_FAST_MODEL,
    embeddingModel: null,
    embeddingDimensions: null,
    supportsEmbeddings: meta.supportsEmbeddings,
    supportsFiles: meta.supportsFiles,
  };
}

/** Proveedores con API key configurada, en el orden de PROVIDER_ORDER. */
export function listConfiguredProviders(): ProviderInfo[] {
  return PROVIDER_ORDER.map(getProviderInfo).filter((p): p is ProviderInfo => p !== null);
}

const clients = new Map<ProviderId, OpenAI>();

/** Cliente OpenAI apuntando al proveedor indicado. Lanza un error claro si falta la API key. */
export function getProviderClient(id: ProviderId): OpenAI {
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
