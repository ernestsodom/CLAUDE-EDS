"use client";

import type { AnalysisMode } from "@/lib/ai-providers";

/**
 * Pide las funcionalidades de UN sistema puntual — la parte de la que
 * depende el comparador Checklist vs Excel (ver runSystemFeatures en
 * ingestion.service.ts). Mismo patrón de reintentos que analyzePart.
 */
export async function analyzeSystemFeatures(
  documentId: string,
  systemId: string,
  onProgress?: (label: string) => void,
  opts: { mode?: AnalysisMode } = {}
): Promise<{ ok: boolean; error?: string; usedLocal?: boolean }> {
  const mode = opts.mode ?? "auto";
  let retries = 0;

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(
        `/api/documents/${documentId}/systems/${systemId}/features?mode=${mode}`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message = json?.error?.message ?? `Error ${res.status}`;
        if (retries < 2 && /429|5\d\d|quota|rate|timeout|exhausted/i.test(message)) {
          retries++;
          onProgress?.(`esperando cuota de la IA (reintento ${retries}/2)…`);
          await new Promise((r) => setTimeout(r, 10000 * retries));
          continue;
        }
        return { ok: false, error: message };
      }

      const usedLocal = json.engine === "local";
      const suffix = json.engineLabel && json.engine !== "gemini" ? ` (${json.engineLabel})` : "";
      onProgress?.((json.detail ? `${json.label} · ${json.detail}` : json.label) + suffix);
      return { ok: true, usedLocal };
    } catch (err) {
      if (retries < 2) {
        retries++;
        await new Promise((r) => setTimeout(r, 5000 * retries));
        continue;
      }
      return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
    }
  }
  return { ok: false, error: "El análisis no pudo completarse" };
}
