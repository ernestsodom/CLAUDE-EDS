import { zodResponseFormat } from "openai/helpers/zod";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import type { z } from "zod";
import { getProviderClient, isOpenAICompatible, modelFor, type ProviderId } from "@/lib/ai-providers";
import { anthropic, CLAUDE_MAX_TOKENS } from "@/lib/anthropic";
import { logger } from "@/lib/logger";
import type { UsageEvent } from "@/core/services/ai-usage.service";

/** Callback opcional: quien llama puede registrar el consumo real que el
 *  proveedor reportó en la respuesta (ver ai-usage.service.ts). Sin él, la
 *  llamada funciona igual — es puramente medición, nunca un requisito. */
type OnUsage = (u: UsageEvent) => void;

/**
 * Salida estructurada con Claude (SDK oficial de Anthropic).
 *
 * El helper `zodOutputFormat` del SDK solo acepta esquemas de Zod v4 y este
 * proyecto usa Zod v3 en todo `core/ai/schemas.ts`. En vez de duplicar los
 * esquemas, se construye el mismo objeto de formato que produce el helper
 * —misma forma: `{ type, schema, parse }`— generando el JSON Schema desde v3
 * con el helper de OpenAI y adaptándolo con el propio transformador del SDK
 * de Anthropic, en lugar de reimplementar esa conversión a mano.
 */
async function claudeStructured<T extends z.ZodTypeAny>(
  opts: { schema: T; schemaName: string; system: string; user: string; onUsage?: OnUsage },
  model: string
): Promise<z.infer<T>> {
  const jsonSchema = (
    zodResponseFormat(opts.schema, opts.schemaName) as unknown as {
      json_schema: { schema: Record<string, unknown> };
    }
  ).json_schema.schema;

  const response = await anthropic().messages.parse({
    model,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: {
      format: {
        type: "json_schema",
        schema: transformJSONSchema(jsonSchema),
        parse: (content: string) => opts.schema.parse(JSON.parse(content)) as z.infer<T>,
      },
    },
  });

  opts.onUsage?.({
    provider: "claude",
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const parsed = response.parsed_output;
  if (parsed == null) {
    // Sucede sobre todo si la respuesta se corta por max_tokens: el JSON queda
    // incompleto y no hay nada que validar.
    throw new Error(
      `Claude no devolvió una respuesta estructurada válida (${opts.schemaName}, stop_reason: ${response.stop_reason}). ` +
        "Si el documento es muy extenso, prueba con otro motor."
    );
  }
  return parsed as z.infer<T>;
}

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
  /** Registra los tokens reales que devolvió el proveedor (ver ai-usage.service.ts). */
  onUsage?: OnUsage;
}): Promise<z.infer<T>> {
  const provider = opts.provider ?? "gemini";
  const model = opts.model ?? modelFor(provider, opts.speed ?? "fast");

  // Claude no habla la API de OpenAI: tiene su propio camino, con salidas
  // estructuradas nativas (output_config.format) y sin necesidad de degradar.
  if (!isOpenAICompatible(provider)) {
    return claudeStructured(opts, model);
  }

  const client = getProviderClient(provider);

  const recordUsage = (usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined) => {
    if (!usage) return;
    opts.onUsage?.({
      provider,
      model,
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    });
  };

  const callStrict = async () => {
    const completion = await client.beta.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: zodResponseFormat(opts.schema, opts.schemaName),
    });
    recordUsage(completion.usage);
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
    recordUsage(completion.usage);
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

/**
 * Generación de texto libre (sin esquema) con el proveedor elegido.
 *
 * La usan las salidas que son prosa y no datos: la redacción de la respuesta
 * a un reclamo, por ejemplo. Igual que `structuredCompletion`, esconde la
 * diferencia entre la API de OpenAI y la de Anthropic tras una sola firma.
 */
export async function textCompletion(opts: {
  system: string;
  user: string;
  provider?: ProviderId;
  speed?: "fast" | "chat";
  maxTokens?: number;
  /** Registra los tokens reales que devolvió el proveedor (ver ai-usage.service.ts). */
  onUsage?: OnUsage;
}): Promise<string> {
  const provider = opts.provider ?? "gemini";
  const model = modelFor(provider, opts.speed ?? "chat");

  if (!isOpenAICompatible(provider)) {
    const response = await anthropic().messages.create({
      model,
      max_tokens: opts.maxTokens ?? CLAUDE_MAX_TOKENS,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    opts.onUsage?.({
      provider: "claude",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    // content es una unión discriminada: hay que estrechar por .type antes de
    // leer .text (puede traer bloques de otros tipos).
    return response.content
      .filter((block): block is { type: "text"; text: string; citations: null } => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  const completion = await getProviderClient(provider).chat.completions.create({
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  if (completion.usage) {
    opts.onUsage?.({
      provider,
      model,
      inputTokens: completion.usage.prompt_tokens ?? 0,
      outputTokens: completion.usage.completion_tokens ?? 0,
    });
  }
  return completion.choices[0]?.message.content ?? "";
}
