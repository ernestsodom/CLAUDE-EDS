// ============================================================================
// Comparación de texto sin IA: normalización y solapamiento de palabras.
// Usado por los motores "Sin IA" — el comparador de documentos
// (heuristic.service.ts) y el chat local (chat.service.ts) — para reconocer
// coincidencias léxicas sin llamar a ningún modelo ni proveedor externo.
// ============================================================================

/** Quita tildes y pasa a minúsculas, para comparar sin que un acento cambie
 *  el resultado ("útil" vs "util"). */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palabras "de contenido" (≥4 letras) en común sobre el menor de los dos
 *  conjuntos — cuán reconocible es un texto en el otro sin usar ningún modelo. */
export function wordOverlap(a: string, b: string): number {
  const words = (t: string) => new Set(norm(t).split(/[^a-zñ0-9]+/).filter((w) => w.length >= 4));
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size);
}
