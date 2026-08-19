/**
 * Precios por millón de tokens, solo para proveedores de pago (hoy, Claude).
 * Gemini y Groq se usan siempre en su nivel gratuito en LicitIA — nunca se
 * les calcula costo, aunque sí se cuentan sus tokens.
 *
 * Gemini y Groq tampoco exponen un saldo o crédito restante vía API con una
 * API key normal (solo límites de tasa por minuto/día, visibles en sus
 * propios paneles); por eso esta app mide lo que ella misma consumió, no un
 * saldo de cuenta.
 */
const CLAUDE_PRICE_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
};

/** Precio de respaldo si el modelo configurado no está en la tabla —
 *  se usa el de Haiku 4.5 (el predeterminado de la app) como aproximación. */
const CLAUDE_FALLBACK = CLAUDE_PRICE_PER_1M["claude-haiku-4-5"];

/** Costo estimado en USD, o null si el proveedor no es de pago (Gemini/Groq/local). */
export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  if (provider !== "claude") return null;
  const price = CLAUDE_PRICE_PER_1M[model] ?? CLAUDE_FALLBACK;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
