import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { MODELS, openai } from "@/lib/openai";
import { logger } from "@/lib/logger";

/**
 * Llama a OpenAI con Structured Outputs y devuelve JSON validado contra
 * el esquema Zod. Reintenta una vez ante fallo de parseo o red.
 */
export async function structuredCompletion<T extends z.ZodTypeAny>(opts: {
  schema: T;
  schemaName: string;
  system: string;
  user: string;
  model?: string;
}): Promise<z.infer<T>> {
  const model = opts.model ?? MODELS.fast;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await openai().beta.chat.completions.parse({
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
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  throw lastError;
}
