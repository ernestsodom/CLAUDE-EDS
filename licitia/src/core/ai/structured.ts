import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getProviderClient, modelFor, type ProviderId } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";

/**
 * Llama a un proveedor de IA compatible con OpenAI con Structured Outputs y
 * devuelve JSON validado contra el esquema Zod. Reintenta una vez ante fallo
 * de parseo o red.
 *
 * Dos formas de elegir el modelo:
 *   - `provider` + `speed`: la vía multi-proveedor (usada por el análisis de
 *     documentos, donde el usuario elige explícitamente el motor).
 *   - `model`: modelo exacto ya resuelto, para compatibilidad con llamadas
 *     existentes que no necesitan elegir proveedor (siempre corre en Gemini).
 */
export async function structuredCompletion<T extends z.ZodTypeAny>(opts: {
  schema: T;
  schemaName: string;
  system: string;
  user: string;
  provider?: ProviderId;
  speed?: "fast" | "chat";
  model?: string;
}): Promise<z.infer<T>> {
  const provider = opts.provider ?? "gemini";
  const model = opts.model ?? modelFor(provider, opts.speed ?? "fast");
  const client = getProviderClient(provider);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await client.beta.chat.completions.parse({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: zodResponseFormat(opts.schema, opts.schemaName),
      });
      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) throw new Error("Respuesta sin contenido estructurado");
      return parsed;
    } catch (err) {
      lastError = err;
      logger.warn("structured_completion_retry", {
        schema: opts.schemaName,
        provider,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  throw lastError;
}
