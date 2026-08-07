import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Selección de motor del Chat IA. Claude (SDK oficial de Anthropic) convive
// con los proveedores compatibles con OpenAI, y en los tres casos el motor lo
// elige el usuario: nunca se cambia solo.
// ============================================================================

async function loadWithEnv(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: () => ({
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      OPENAI_CHAT_MODEL: "gemini-3.6-flash",
      OPENAI_FAST_MODEL: "gemini-3.5-flash-lite",
      OPENAI_EMBEDDING_MODEL: "gemini-embedding-001",
      GROQ_API_KEY: env.GROQ_API_KEY,
      GROQ_BASE_URL: "https://api.groq.com/openai/v1",
      GROQ_CHAT_MODEL: "openai/gpt-oss-120b",
      GROQ_FAST_MODEL: "openai/gpt-oss-20b",
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      ANTHROPIC_CHAT_MODEL: env.ANTHROPIC_CHAT_MODEL ?? "claude-haiku-4-5",
    }),
  }));
  return import("@/core/services/chat.service");
}

describe("motores del chat", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("solo ofrece los motores con API key configurada", async () => {
    const { listChatEngines } = await loadWithEnv({
      OPENAI_API_KEY: "clave-gemini-valida",
      ANTHROPIC_API_KEY: "clave-anthropic-valida",
    });
    expect(listChatEngines().map((e) => e.id)).toEqual(["gemini", "claude"]);
  });

  it("no ofrece Claude si falta ANTHROPIC_API_KEY", async () => {
    const { listChatEngines, isChatEngineConfigured } = await loadWithEnv({
      OPENAI_API_KEY: "clave-gemini-valida",
    });
    expect(listChatEngines().map((e) => e.id)).toEqual(["gemini"]);
    expect(isChatEngineConfigured("claude")).toBe(false);
  });

  it("devuelve una lista vacía cuando no hay ningún motor configurado", async () => {
    const { listChatEngines } = await loadWithEnv({});
    expect(listChatEngines()).toEqual([]);
  });

  it("etiqueta Claude con su modelo económico (Haiku 4.5)", async () => {
    const { CHAT_ENGINE_LABELS } = await loadWithEnv({ ANTHROPIC_API_KEY: "clave-anthropic-valida" });
    expect(CHAT_ENGINE_LABELS.claude).toContain("Haiku 4.5");
  });

  it("falla con un mensaje claro si se pide un motor sin configurar", async () => {
    const chat = await loadWithEnv({ OPENAI_API_KEY: "clave-gemini-valida" });
    await expect(
      chat.streamChatTurn({
        supabase: {} as never,
        agent: "analista",
        question: "¿Qué multas contempla?",
        history: [],
        filters: {},
        engine: "claude",
      })
    ).rejects.toThrow(/no está configurado/i);
  });
});

describe("cliente de Claude", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("usa claude-haiku-4-5 por defecto", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ ANTHROPIC_API_KEY: "clave-anthropic-valida", ANTHROPIC_CHAT_MODEL: "claude-haiku-4-5" }),
    }));
    const { claudeModel, isClaudeConfigured } = await import("@/lib/anthropic");
    expect(claudeModel()).toBe("claude-haiku-4-5");
    expect(isClaudeConfigured()).toBe(true);
  });

  it("explica qué falta cuando no hay API key", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: () => ({ ANTHROPIC_API_KEY: undefined, ANTHROPIC_CHAT_MODEL: "claude-haiku-4-5" }),
    }));
    const { anthropic } = await import("@/lib/anthropic");
    expect(() => anthropic()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
