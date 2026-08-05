import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env().OPENAI_API_KEY,
      baseURL: env().OPENAI_BASE_URL, // undefined ⇒ API oficial de OpenAI
    });
  }
  return client;
}

export const MODELS = {
  get chat() {
    return env().OPENAI_CHAT_MODEL;
  },
  get fast() {
    return env().OPENAI_FAST_MODEL;
  },
  get embedding() {
    return env().OPENAI_EMBEDDING_MODEL;
  },
};

/** Genera embeddings en lote (la API acepta hasta 2048 inputs por llamada). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const BATCH = 100;
  const result: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 32000));
    const res = await openai().embeddings.create({
      model: MODELS.embedding,
      input: batch,
      ...(env().OPENAI_EMBEDDING_DIMENSIONS
        ? { dimensions: env().OPENAI_EMBEDDING_DIMENSIONS }
        : {}),
    });
    for (const item of res.data) result.push(item.embedding);
  }
  return result;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
