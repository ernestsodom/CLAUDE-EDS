import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ai-providers.ts lee env() en cada llamada (sin caché propia), así que cada
 * prueba mockea "@/lib/env" con el conjunto de claves que quiere simular y
 * reimporta el módulo en limpio con vi.resetModules().
 */
async function loadWithEnv(envOverrides: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: () => ({
      OPENAI_CHAT_MODEL: "gemini-3.6-flash",
      OPENAI_FAST_MODEL: "gemini-3.5-flash-lite",
      OPENAI_EMBEDDING_MODEL: "gemini-embedding-001",
      OPENAI_EMBEDDING_DIMENSIONS: 1536,
      OPENAI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      GROQ_BASE_URL: "https://api.groq.com/openai/v1",
      GROQ_CHAT_MODEL: "llama-3.3-70b-versatile",
      GROQ_FAST_MODEL: "llama-3.1-8b-instant",
      ANTHROPIC_CHAT_MODEL: "claude-haiku-4-5",
      ...envOverrides,
    }),
  }));
  return import("@/lib/ai-providers");
}

describe("ai-providers — proveedor no configurado", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("ningún proveedor configurado ⇒ listConfiguredProviders vacío", async () => {
    const ai = await loadWithEnv({});
    expect(ai.isProviderConfigured("gemini")).toBe(false);
    expect(ai.isProviderConfigured("groq")).toBe(false);
    expect(ai.listConfiguredProviders()).toEqual([]);
    expect(ai.getProviderInfo("gemini")).toBeNull();
  });

  it("getProviderClient lanza un error claro en español si falta la API key", async () => {
    const ai = await loadWithEnv({});
    expect(() => ai.getProviderClient("groq")).toThrow(/Groq no está configurado/);
  });

  it("modelFor lanza si el proveedor no está configurado", async () => {
    const ai = await loadWithEnv({});
    expect(() => ai.modelFor("gemini", "fast")).toThrow(/Gemini no está configurado/);
  });

  it("embedWithProvider lanza si el proveedor no soporta embeddings", async () => {
    const ai = await loadWithEnv({ GROQ_API_KEY: "gsk_test_key_1234567890" });
    await expect(ai.embedWithProvider("groq", ["texto"])).rejects.toThrow(/no ofrece generación de embeddings/);
  });
});

describe("ai-providers — solo Gemini configurado", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("expone Gemini con sus capacidades y modelos", async () => {
    const ai = await loadWithEnv({ OPENAI_API_KEY: "AQ.test_key_1234567890" });
    expect(ai.isProviderConfigured("gemini")).toBe(true);
    expect(ai.isProviderConfigured("groq")).toBe(false);

    const info = ai.getProviderInfo("gemini");
    expect(info).toMatchObject({
      id: "gemini",
      label: "Gemini",
      chatModel: "gemini-3.6-flash",
      fastModel: "gemini-3.5-flash-lite",
      embeddingModel: "gemini-embedding-001",
      embeddingDimensions: 1536,
      supportsEmbeddings: true,
      supportsFiles: true,
    });
  });

  it("listConfiguredProviders devuelve solo Gemini", async () => {
    const ai = await loadWithEnv({ OPENAI_API_KEY: "AQ.test_key_1234567890" });
    expect(ai.listConfiguredProviders().map((p) => p.id)).toEqual(["gemini"]);
  });

  it("modelFor resuelve fast/chat correctamente", async () => {
    const ai = await loadWithEnv({ OPENAI_API_KEY: "AQ.test_key_1234567890" });
    expect(ai.modelFor("gemini", "fast")).toBe("gemini-3.5-flash-lite");
    expect(ai.modelFor("gemini", "chat")).toBe("gemini-3.6-flash");
  });
});

describe("ai-providers — ambos proveedores configurados", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("Groq no ofrece embeddings ni Files API", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      GROQ_API_KEY: "gsk_test_key_1234567890",
    });
    const info = ai.getProviderInfo("groq");
    expect(info).toMatchObject({
      id: "groq",
      label: "Groq",
      chatModel: "llama-3.3-70b-versatile",
      fastModel: "llama-3.1-8b-instant",
      embeddingModel: null,
      supportsEmbeddings: false,
      supportsFiles: false,
    });
  });

  it("respeta el orden de preferencia gemini → groq en listConfiguredProviders", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      GROQ_API_KEY: "gsk_test_key_1234567890",
    });
    expect(ai.listConfiguredProviders().map((p) => p.id)).toEqual(["gemini", "groq"]);
  });

  it("getProviderClient da un cliente distinto por proveedor, apuntando a su baseURL", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      GROQ_API_KEY: "gsk_test_key_1234567890",
    });
    const gemini = ai.getProviderClient("gemini");
    const groq = ai.getProviderClient("groq");
    expect(gemini).not.toBe(groq);
    expect(gemini.baseURL).toContain("generativelanguage.googleapis.com");
    expect(groq.baseURL).toContain("api.groq.com");
  });

  it("ENGINE_LABELS cubre los cinco modos", async () => {
    const ai = await loadWithEnv({});
    expect(ai.ENGINE_LABELS).toEqual({
      gemini: "Gemini",
      groq: "Groq",
      claude: "Claude Haiku 4.5",
      local: "modo local",
      auto: "automático",
    });
  });
});

describe("ai-providers — Claude (de pago, fuera de la cadena de 'auto')", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("isOpenAICompatible distingue a Claude de los proveedores compatibles con OpenAI", async () => {
    const ai = await loadWithEnv({});
    expect(ai.isOpenAICompatible("gemini")).toBe(true);
    expect(ai.isOpenAICompatible("groq")).toBe(true);
    expect(ai.isOpenAICompatible("claude")).toBe(false);
  });

  it("getProviderClient lanza para Claude: usa su propio cliente (lib/anthropic.ts), no el de OpenAI", async () => {
    const ai = await loadWithEnv({ ANTHROPIC_API_KEY: "sk-ant-test-1234567890" });
    expect(() => ai.getProviderClient("claude")).toThrow(/SDK oficial/);
  });

  it("se marca isPaid=true para Claude y false para Gemini/Groq", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      GROQ_API_KEY: "gsk_test_key_1234567890",
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890",
    });
    expect(ai.getProviderInfo("claude")?.isPaid).toBe(true);
    expect(ai.getProviderInfo("gemini")?.isPaid).toBe(false);
    expect(ai.getProviderInfo("groq")?.isPaid).toBe(false);
  });

  it("listConfiguredProviders SÍ incluye a Claude cuando está configurado (el usuario puede elegirlo)", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890",
    });
    expect(ai.listConfiguredProviders().map((p) => p.id)).toEqual(["gemini", "claude"]);
  });

  it("listAutoProviders NUNCA incluye a Claude, aunque esté configurado: 'auto' no gasta dinero sin permiso", async () => {
    const ai = await loadWithEnv({
      OPENAI_API_KEY: "AQ.test_key_1234567890",
      GROQ_API_KEY: "gsk_test_key_1234567890",
      ANTHROPIC_API_KEY: "sk-ant-test-1234567890",
    });
    expect(ai.listAutoProviders()).toEqual(["gemini", "groq"]);
    expect(ai.listAutoProviders()).not.toContain("claude");
  });

  it("modelFor usa el mismo modelo Haiku 4.5 para 'fast' y 'chat': ya es el más económico", async () => {
    const ai = await loadWithEnv({ ANTHROPIC_API_KEY: "sk-ant-test-1234567890" });
    expect(ai.modelFor("claude", "fast")).toBe("claude-haiku-4-5");
    expect(ai.modelFor("claude", "chat")).toBe("claude-haiku-4-5");
  });
});
