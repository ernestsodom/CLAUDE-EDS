import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getProviderClient, modelFor, type ProviderId } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";

/** Un modelo no soporta el modo estricto de Structured Outputs (json_schema). */
const UNSUPPORTED_SCHEMA_ERROR =
  /does not support response format|response_format.*not supported|json_schema.*not support|unsupported.*json_schema/i;

/**
 * Llama a un proveedor de IA compatible con OpenAI y devuelve JSON validado
 * contra el esquema Zod.
 *
 * Dos formas de elegir el modelo:
 *   - `provider` + `speed`: la vía multi-proveedor (usada por el análisis de
 *     documentos, donde el usuario elige explícitamente el motor).
 *   - `model`: modelo exacto ya resuelto, para compatibilidad con llamadas
 *     existentes que no necesitan elegir proveedor (siempre corre en Gemini).
 *
 * Estrategia en dos niveles, para no depender de que CADA modelo de CADA
 * proveedor soporte el modo estricto (`strict: true`) de Structured Outputs
 * — algunos, como la mayoría de los modelos de Groq salvo `gpt-oss-*`, no lo
 * soportan y devuelven un error 400 explícito:
 *   1. Modo estricto (`response_format: json_schema`): el proveedor garantiza
 *      JSON válido contra el esquema. Se usa siempre primero.
 *   2. Si el proveedor responde que no soporta ese modo, se reintenta en
 *      modo JSON simple (`response_format: json_object`), incluyendo el
 *      esquema en el prompt y validando la respuesta con Zod del lado
 *      cliente. Menos garantizado, pero funciona en cualquier modelo.
 * Cualquier otro tipo de error (cuota, red) se propaga tal cual, sin
 * malgastar reintentos en modo estricto.
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

  const callStrict = async () => {
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
  };

  const callJsonObject = async () => {
    // zodResponseFormat expone el JSON Schema subyacente; se incluye en el
    // prompt para guiar al modelo en modo "mejor esfuerzo".
    const strictFormat = zodResponseFormat(opts.schema, opts.schemaName) as unknown as {
      json_schema: { schema: unknown };
    };
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            `${opts.system}\n\nResponde EXCLUSIVAMENTE con un JSON válido (sin texto adicional, ` +
            `sin bloques de markdown) que cumpla exactamente este JSON Schema:\n` +
            JSON.stringify(strictFormat.json_schema.schema),
        },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Respuesta vacía del proveedor");
    const candidate: unknown = JSON.parse(raw);
    const result = opts.schema.safeParse(candidate);
    if (!result.success) {
      throw new Error(`El JSON del modelo no cumple el esquema esperado: ${result.error.message.slice(0, 300)}`);
    }
    return result.data as z.infer<T>;
  };

  let mode: "strict" | "json_object" = "strict";
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return mode === "strict" ? await callStrict() : await callJsonObject();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("structured_completion_retry", { schema: opts.schemaName, provider, model, mode, attempt, error: message });

      if (mode === "strict" && UNSUPPORTED_SCHEMA_ERROR.test(message)) {
        // El modelo no soporta json_schema estricto: cambia de estrategia y
        // reintenta de inmediato, sin gastar un intento en repetir lo mismo.
        mode = "json_object";
        continue;
      }
      // Errores de cuota/red no se benefician de reintentar en el mismo modo.
      if (/429|quota|rate.?limit|resource.?exhausted|too many requests/i.test(message)) break;
    }
  }
  throw lastError;
}
