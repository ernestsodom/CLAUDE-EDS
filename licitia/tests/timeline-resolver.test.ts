import { describe, expect, it } from "vitest";
import { resolveTimelineDates } from "@/core/services/timeline-resolver";
import type { TimelineMilestone } from "@/core/ai/schemas";

/** Hito mínimo con overrides — evita repetir todos los campos en cada caso. */
function hito(overrides: Partial<TimelineMilestone>): TimelineMilestone {
  return {
    tipo: "hito",
    titulo: "Hito de prueba",
    descripcion: null,
    fecha_inicio: null,
    fecha_fin: null,
    plazo_texto: null,
    plazo_dias: null,
    ancla: null,
    pagina: null,
    cita: null,
    ...overrides,
  };
}

describe("resolveTimelineDates", () => {
  it("calcula la fecha desde el ancla del documento y la marca como estimada", () => {
    const [r] = resolveTimelineDates(
      [hito({ titulo: "Marcha blanca", plazo_texto: "40 días corridos desde la firma", plazo_dias: 40, ancla: "documento" })],
      "2026-07-15"
    );
    expect(r.fecha_inicio).toBe("2026-08-24");
    expect(r.fecha_estimada).toBe(true);
  });

  it("no toca una fecha ya explícita en el documento", () => {
    const [r] = resolveTimelineDates(
      [hito({ fecha_inicio: "2026-09-01", plazo_dias: 40, ancla: "documento" })],
      "2026-07-15"
    );
    expect(r.fecha_inicio).toBe("2026-09-01");
    expect(r.fecha_estimada).toBe(false);
  });

  it("encadena un hito 'hito_anterior' desde la fecha resuelta del hito previo, no desde el ancla del documento", () => {
    const resolved = resolveTimelineDates(
      [
        hito({ titulo: "Inicio", plazo_dias: 10, ancla: "documento" }),
        hito({ titulo: "Capacitación", plazo_dias: 5, ancla: "hito_anterior" }),
      ],
      "2026-01-01"
    );
    expect(resolved[0].fecha_inicio).toBe("2026-01-11");
    expect(resolved[1].fecha_inicio).toBe("2026-01-16");
    expect(resolved.every((r) => r.fecha_estimada)).toBe(true);
  });

  it("sin ancla del documento ni hito previo resuelto, deja el plazo relativo sin fecha", () => {
    const [r] = resolveTimelineDates([hito({ plazo_dias: 30, ancla: "documento" })], null);
    expect(r.fecha_inicio).toBeNull();
    expect(r.fecha_estimada).toBe(false);
  });

  it("un hito sin plazo relativo ni fecha explícita queda intacto", () => {
    const [r] = resolveTimelineDates([hito({ plazo_texto: null, plazo_dias: null, ancla: null })], "2026-01-01");
    expect(r.fecha_inicio).toBeNull();
    expect(r.fecha_estimada).toBe(false);
  });
});
