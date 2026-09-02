"use client";

import type { AnalysisMode } from "@/lib/ai-providers";
import type { AnalysisPart } from "@/core/services/ingestion.service";

/**
 * Pide UNA parte del análisis (resumen, sistemas, línea de tiempo, evaluación
 * y anexos, puntos críticos, o los vectores del chat) — independiente de las
 * demás: si falla, solo esa parte queda en error, y las demás conservan lo
 * que ya tenían.
 *
 * Solo `chat` puede necesitar varias llamadas (vectoriza por lotes); las
 * demás terminan en una sola.
 */
export async function analyzePart(
  documentId: string,
  part: AnalysisPart,
  onProgress?: (label: string) => void,
  opts: { mode?: AnalysisMode; maxCalls?: number } = {}
): Promise<{ ok: boolean; error?: string; usedLocal?: boolean }> {
  const mode = opts.mode ?? "auto";
  const maxCalls = opts.maxCalls ?? 30;
  let retries = 0;
  let usedLocal = false;

  for (let i = 0; i < maxCalls; i++) {
    try {
      const res = await fetch(`/api/documents/${documentId}/analyze?part=${part}&mode=${mode}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message = json?.error?.message ?? `Error ${res.status}`;
        // Cuota agotada de forma transitoria, o timeout propio de la etapa
        // (o el 504 que devuelve la plataforma cuando corta la función sola):
        // en ambos casos reintentar solo suele bastar, sin que el usuario
        // tenga que volver a apretar el botón — la parte se puede repetir
        // desde cero sin arrastrar nada de las demás.
        if (retries < 2 && /429|5\d\d|quota|rate|timeout|exhausted/i.test(message)) {
          retries++;
          onProgress?.(`esperando cuota de la IA (reintento ${retries}/2)…`);
          await new Promise((r) => setTimeout(r, 10000 * retries));
          continue;
        }
        return { ok: false, error: message, usedLocal };
      }

      if (json.engine === "local") usedLocal = true;
      const suffix = json.engineLabel && json.engine !== "gemini" ? ` (${json.engineLabel})` : "";
      onProgress?.((json.detail ? `${json.label} · ${json.detail}` : json.label) + suffix);
      if (json.done) return { ok: true, usedLocal };
    } catch (err) {
      if (retries < 3) {
        retries++;
        await new Promise((r) => setTimeout(r, 5000 * retries));
        continue;
      }
      return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
    }
  }
  return { ok: false, error: "El análisis no terminó en el número previsto de llamadas" };
}
