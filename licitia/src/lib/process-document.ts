"use client";

/**
 * Avanza el procesamiento de un documento etapa por etapa desde el navegador.
 *
 * El pipeline se ejecuta en tramos acotados (una etapa por petición) porque
 * las funciones serverless tienen un límite de duración y no garantizan el
 * trabajo lanzado en segundo plano. Este ayudante encadena las llamadas y
 * reporta el avance, reintentando los fallos transitorios (p. ej. cuotas del
 * plan gratuito de la IA).
 */
export async function processDocument(
  documentId: string,
  onProgress?: (label: string) => void,
  opts: { restart?: boolean; maxStages?: number } = {}
): Promise<{ ok: boolean; error?: string }> {
  const maxStages = opts.maxStages ?? 40;
  let endpoint = opts.restart ? "reprocess" : "process";
  let retries = 0;

  for (let i = 0; i < maxStages; i++) {
    try {
      const res = await fetch(`/api/documents/${documentId}/${endpoint}`, { method: "POST" });
      endpoint = "process";
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message = json?.error?.message ?? `Error ${res.status}`;
        // Cuota de la IA agotada momentáneamente: esperar y reintentar
        if (retries < 3 && /429|quota|rate|timeout|exhausted/i.test(message)) {
          retries++;
          onProgress?.(`esperando cuota de la IA (reintento ${retries}/3)…`);
          await new Promise((r) => setTimeout(r, 12000 * retries));
          continue;
        }
        return { ok: false, error: message };
      }

      onProgress?.(json.detail ? `${json.label} · ${json.detail}` : json.label);
      if (json.done) return { ok: true };
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
