import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * structuredCompletion() debe degradar de modo estricto (json_schema) a
 * modo JSON simple + validación propia cuando el modelo responde que no
 * soporta json_schema estricto — el caso real observado con Groq al usar
 * un modelo fuera de la familia gpt-oss.
 */
const TestSchema = z.object({ titulo: z.string(), monto: z.number() });

function mockClient(overrides: {
  parse?: (...args: unknown[]) => unknown;
  create?: (...args: unknown[]) => unknown;
}) {
  return {
    beta: { chat: { completions: { parse: overrides.parse ?? vi.fn() } } },
    chat: { completions: { create: overrides.create ?? vi.fn() } },
  };
}

async function loadWithClient(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/ai-providers", () => ({
    getProviderClient: () => client,
    modelFor: () => "modelo-de-prueba",
    isOpenAICompatible: () => true, // estas pruebas cubren el camino OpenAI-compatible
  }));
  vi.doMock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
  return import("@/core/ai/structured");
}

describe("structuredCompletion — modo estricto", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock("@/lib/ai-providers");
    vi.doUnmock("@/lib/logger");
  });

  it("devuelve el resultado directamente cuando el modo estricto funciona", async () => {
    const client = mockClient({
      parse: vi.fn().mockResolvedValue({
        choices: [{ message: { parsed: { titulo: "Licitación X", monto: 100 } } }],
      }),
    });
    const { structuredCompletion } = await loadWithClient(client);
    const result = await structuredCompletion({
      schema: TestSchema,
      schemaName: "prueba",
      system: "sys",
      user: "usr",
    });
    expect(result).toEqual({ titulo: "Licitación X", monto: 100 });
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });
});

describe("structuredCompletion — degradación a JSON simple", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock("@/lib/ai-providers");
    vi.doUnmock("@/lib/logger");
  });

  it("cambia a modo json_object cuando el modelo no soporta json_schema (caso real de Groq)", async () => {
    const client = mockClient({
      parse: vi.fn().mockRejectedValue(
        new Error(
          "400 This model does not support response format `json_schema`. See supported models at https://console.groq.com/docs/structured-outputs#supported-models"
        )
      ),
      create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ titulo: "Contrato Y", monto: 50 }) } }],
      }),
    });
    const { structuredCompletion } = await loadWithClient(client);
    const result = await structuredCompletion({
      schema: TestSchema,
      schemaName: "prueba",
      system: "sys",
      user: "usr",
    });
    expect(result).toEqual({ titulo: "Contrato Y", monto: 50 });
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    // El fallback no repite el intento estricto fallido: una sola llamada a parse.
    expect(client.beta.chat.completions.parse).toHaveBeenCalledTimes(1);
  });

  it("incluye el JSON Schema en el prompt del modo de respaldo", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ titulo: "Z", monto: 1 }) } }],
    });
    const client = mockClient({
      parse: vi.fn().mockRejectedValue(new Error("does not support response format json_schema")),
      create,
    });
    const { structuredCompletion } = await loadWithClient(client);
    await structuredCompletion({ schema: TestSchema, schemaName: "prueba", system: "sys", user: "usr" });

    const call = create.mock.calls[0][0];
    expect(call.response_format).toEqual({ type: "json_object" });
    expect(call.messages[0].content).toContain("titulo");
    expect(call.messages[0].content).toContain("JSON Schema");
  });

  it("rechaza si el JSON del modo de respaldo no cumple el esquema", async () => {
    const client = mockClient({
      parse: vi.fn().mockRejectedValue(new Error("does not support response format json_schema")),
      create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ titulo: "sin monto" }) } }],
      }),
    });
    const { structuredCompletion } = await loadWithClient(client);
    await expect(
      structuredCompletion({ schema: TestSchema, schemaName: "prueba", system: "sys", user: "usr" })
    ).rejects.toThrow(/no cumple el esquema/);
  });

  it("no cambia de modo ante un error de cuota: falla rápido sin malgastar reintentos", async () => {
    const parse = vi.fn().mockRejectedValue(new Error("429 Resource has been exhausted"));
    const client = mockClient({ parse });
    const { structuredCompletion } = await loadWithClient(client);
    await expect(
      structuredCompletion({ schema: TestSchema, schemaName: "prueba", system: "sys", user: "usr" })
    ).rejects.toThrow(/429/);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });
});

describe("structuredCompletion — Claude (SDK oficial de Anthropic)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock("@/lib/ai-providers");
    vi.doUnmock("@/lib/anthropic");
    vi.doUnmock("@/lib/logger");
  });

  async function loadWithAnthropicMock(parseImpl: (...args: unknown[]) => unknown) {
    vi.resetModules();
    vi.doMock("@/lib/ai-providers", () => ({
      // Claude no debe pasar por getProviderClient/modelFor de OpenAI.
      getProviderClient: () => {
        throw new Error("no debería llamarse para Claude");
      },
      modelFor: () => "modelo-de-prueba",
      isOpenAICompatible: (id: string) => id !== "claude",
    }));
    vi.doMock("@/lib/anthropic", () => ({
      anthropic: () => ({ messages: { parse: parseImpl } }),
      CLAUDE_MAX_TOKENS: 8000,
    }));
    vi.doMock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
    return import("@/core/ai/structured");
  }

  it("usa output_config.format y devuelve parsed_output", async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { titulo: "Licitación Claude", monto: 200 },
    });
    const { structuredCompletion } = await loadWithAnthropicMock(parse);

    const result = await structuredCompletion({
      schema: TestSchema,
      schemaName: "prueba",
      provider: "claude",
      system: "sys",
      user: "usr",
    });

    expect(result).toEqual({ titulo: "Licitación Claude", monto: 200 });
    const call = parse.mock.calls[0][0];
    expect(call.output_config.format.type).toBe("json_schema");
    expect(typeof call.output_config.format.schema).toBe("object");
    expect(call.max_tokens).toBe(8000);
  });

  it("lanza un error legible si Claude no devuelve parsed_output (p.ej. corte por max_tokens)", async () => {
    const parse = vi.fn().mockResolvedValue({ stop_reason: "max_tokens", parsed_output: null });
    const { structuredCompletion } = await loadWithAnthropicMock(parse);

    await expect(
      structuredCompletion({
        schema: TestSchema,
        schemaName: "prueba",
        provider: "claude",
        system: "sys",
        user: "usr",
      })
    ).rejects.toThrow(/max_tokens/);
  });
});
