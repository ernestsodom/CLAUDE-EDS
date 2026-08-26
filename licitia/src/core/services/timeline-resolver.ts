import type { TimelineMilestone } from "@/core/ai/schemas";

export interface ResolvedMilestone extends TimelineMilestone {
  /** true si esta fecha la calculó el sistema a partir de un plazo relativo
   *  (nunca la dice el documento literalmente) — la interfaz debe marcarla
   *  como estimación, nunca como un hecho del documento. */
  fecha_estimada: boolean;
}

/** Suma N días corridos a una fecha ISO (YYYY-MM-DD). Sin librerías: los
 *  cronogramas de licitación cuentan días corridos o hábiles según el
 *  documento, pero la extracción ya deja plazo_dias en corridos — la
 *  aritmética de calendario (incluidos años bisiestos) la hace el motor
 *  nativo de Date, no la IA, para no arrastrar errores de cálculo. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Convierte los plazos relativos de una línea de tiempo ("40 días corridos
 * desde la firma del contrato") en fechas calendario concretas, usando la
 * fecha del documento (`documentAnchor` — típicamente su fecha de
 * publicación) como ancla del proceso completo. Es la mejor aproximación
 * disponible: la fecha real del evento de referencia (firma, adjudicación)
 * casi nunca se conoce todavía cuando se publica una licitación.
 *
 * Los hitos marcados ancla="hito_anterior" se encadenan desde la fecha
 * (explícita o ya estimada) del hito inmediatamente anterior en el array —
 * así una secuencia de "X días después del hito previo" no colapsa todos
 * los hitos al mismo punto de partida del documento.
 *
 * Toda fecha resuelta acá (no una que el documento ya traía explícita) se
 * marca con fecha_estimada=true — nunca se presenta como un dato literal
 * del documento, sino como el cálculo que es.
 */
export function resolveTimelineDates(
  hitos: TimelineMilestone[],
  documentAnchor: string | null
): ResolvedMilestone[] {
  let previousResolved: string | null = null;

  return hitos.map((h) => {
    if (h.fecha_inicio) {
      previousResolved = h.fecha_fin ?? h.fecha_inicio;
      return { ...h, fecha_estimada: false };
    }
    if (h.plazo_dias == null) {
      return { ...h, fecha_estimada: false };
    }

    const base = h.ancla === "hito_anterior" ? previousResolved : documentAnchor;
    if (!base) {
      // Sin ancla disponible (ni la del hito anterior ni la del documento):
      // no hay de dónde calcular, se deja el plazo relativo tal cual.
      return { ...h, fecha_estimada: false };
    }

    const fecha = addDays(base, h.plazo_dias);
    previousResolved = fecha;
    return { ...h, fecha_inicio: fecha, fecha_estimada: true };
  });
}
