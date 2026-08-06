"use client";

import type { AnalysisMode } from "@/lib/ai-providers";

/**
 * Avanza el procesamiento de un documento etapa por etapa desde el navegador.
 *
 * El pipeline se ejecuta en tramos acotados (una etapa por petición) porque
 * las funciones serverless tienen un límite de duración y no garantizan el
 * trabajo lanzado en segundo plano. Este ayudante encadena las llamadas y
 * reporta el avance, incluyendo qué motor de IA ejecutó cada etapa.
 *
 * El motor (`mode`) es siempre una elección explícita del usuario — este
 * ayudante NO cambia de motor por su cuenta; el único modo que prueba varios
 * proveedores es 'auto', y eso ocurre en el servidor porque el usuario lo
 * eligió así, no como comportamiento oculto por defecto.
 */
export async function processDocument(
  documentId: string,
  onProgress?: (label: string) => void,
  opts: { restart?: boolean; maxStages?: number; mode?: AnalysisMode } = {}
): Promise<{ ok: boolean; error?: string; usedLocal?: boolean }> {
  const maxStages = opts.maxStages ?? 40;
  const mode = opts.mode ?? "auto";
  let endpoint = opts.restart ? "reprocess" : "process";
  let retries = 0;
  let usedLocal = false;

  for (let i = 0; i < maxStages; i++) {
    try {
      const res = await fetch(`/api/documents/${documentId}/${endpoint}?mode=${mode}`, {
        method: "POST",
      });
      endpoint = "process";
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message = json?.error?.message ?? `Error ${res.status}`;
        // Cuota agotada de forma transitoria: solo reintenta en modo 'auto'
        // (donde el servidor ya intentó otros proveedores) o cuando el
        // propio proveedor elegido puede recuperarse en unos segundos.
        if (retries < 2 && /429|quota|rate|timeout|exhausted/i.test(message)) {
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
  return { ok: false, error: "El procesamiento no terminó en el número previsto de etapas" };
}
