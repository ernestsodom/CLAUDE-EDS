import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

// ============================================================================
// Claude (Anthropic) — SDK oficial.
//
// A diferencia de Gemini y Groq, que se consumen a través de su capa
// compatible con la API de OpenAI (lib/ai-providers.ts), Claude se usa con su
// propio SDK: su API no es compatible con la de OpenAI (system va fuera de
// messages, max_tokens es obligatorio, el streaming emite otros eventos) y
// forzarla a través de un adaptador solo escondería esas diferencias.
//
// Por eso Claude aparece únicamente en el Chat IA, donde el valor está en la
// calidad de la conversación. El pipeline de ingesta —que necesita salidas
// estructuradas homogéneas entre proveedores— sigue en el registro OpenAI.
// ============================================================================

let client: Anthropic | null = null;

export function isClaudeConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

export function anthropic(): Anthropic {
  if (!client) {
    const apiKey = env().ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Claude no está configurado (falta ANTHROPIC_API_KEY). Elige otro motor en el chat."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Modelo de chat. Por defecto Haiku 4.5: el más económico y rápido de la familia. */
export function claudeModel(): string {
  return env().ANTHROPIC_CHAT_MODEL;
}

/** Tope de tokens de respuesta. Haiku 4.5 admite hasta 64.000. */
export const CLAUDE_MAX_TOKENS = 8000;
