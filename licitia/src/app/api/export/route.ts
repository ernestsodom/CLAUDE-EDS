import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { exportAs, EXPORT_MIME, type ExportPayload } from "@/core/services/export.service";
import { CRITICAL_TYPE_LABELS } from "@/core/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  format: z.enum(["docx", "pdf"]),
  kind: z.enum(["resumen", "comparacion", "requerimientos"]),
  entityId: z.string().uuid(),
});

/** POST /api/export — genera y descarga el export solicitado. */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const { format, kind, entityId } = parsed.data;

  let payload: ExportPayload;

  if (kind === "resumen") {
    const { data: s } = await supabase
      .from("document_summaries")
      .select("*, documents(title)")
      .eq("document_id", entityId)
      .maybeSingle();
    if (!s) throw new NotFoundError("Resumen no encontrado");
    const list = (items: Array<{ titulo: string; detalle: string }> | null) =>
      (items ?? []).map((i) => `${i.titulo}: ${i.detalle}`);
    payload = {
      title: `Informe Ejecutivo — ${s.documents?.title ?? ""}`,
      sections: [
        { title: "Resumen general", paragraphs: [s.summary ?? ""] },
        { title: "Objetivo", paragraphs: [s.objective ?? ""] },
        { title: "Alcance", paragraphs: [s.scope ?? ""] },
        { title: "Requerimientos", paragraphs: list(s.requirements) },
        { title: "Obligaciones", paragraphs: list(s.obligations) },
        { title: "Restricciones", paragraphs: list(s.restrictions) },
        {
          title: "Riesgos",
          paragraphs: ((s.risks ?? []) as Array<{ riesgo: string; nivel: string; mitigacion: string }>).map(
            (r) => `[${r.nivel.toUpperCase()}] ${r.riesgo} — Mitigación: ${r.mitigacion}`
          ),
        },
        { title: "Aspectos críticos", paragraphs: list(s.critical_points) },
        { title: "Entregables", paragraphs: list(s.deliverables) },
        {
          title: "Cronograma",
          paragraphs: ((s.schedule ?? []) as Array<{ hito: string; plazo: string }>).map(
            (h) => `${h.hito}: ${h.plazo}`
          ),
        },
        { title: "Recomendaciones", paragraphs: (s.recommendations ?? []) as string[] },
      ],
    };
  } else if (kind === "comparacion") {
    const { data: cmp } = await supabase
      .from("comparisons")
      .select("*, comparison_items(*)")
      .eq("id", entityId)
      .maybeSingle();
    if (!cmp) throw new NotFoundError("Comparación no encontrada");
    payload = {
      title: `Informe de Cumplimiento (${cmp.traffic_light ?? "s/e"})`,
      sections: [{ title: "Resumen", paragraphs: [cmp.summary ?? ""] }],
      table: {
        headers: ["Requerimiento", "Estado", "Evidencia", "Página", "Comentario IA", "Riesgo", "Prioridad"],
        rows: (cmp.comparison_items ?? []).map(
          (i: Record<string, unknown>) => [
            String(i.requirement_text ?? ""),
            String(i.status ?? ""),
            String(i.evidence_quote ?? ""),
            String(i.evidence_page ?? ""),
            String(i.ai_comment ?? ""),
            String(i.risk ?? ""),
            String(i.priority ?? ""),
          ]
        ),
      },
    };
  } else {
    const { data: reqs } = await supabase
      .from("requirements")
      .select("*")
      .eq("document_id", entityId)
      .order("created_at");
    payload = {
      title: "Puntos críticos para participar",
      table: {
        headers: ["Tipo", "Código", "Exigencia", "Descripción", "Obligatorio", "Página", "Prioridad", "Cita"],
        rows: (reqs ?? []).map((r) => [
          CRITICAL_TYPE_LABELS[r.critical_type as keyof typeof CRITICAL_TYPE_LABELS] ??
            r.critical_type ??
            "Otros",
          r.code ?? "", r.title, r.description ?? "",
          r.mandatory ? "Sí" : "No", String(r.page ?? ""), r.priority, r.quote ?? "",
        ]),
      },
    };
  }

  const buffer = await exportAs(format, payload);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": EXPORT_MIME[format],
      "Content-Disposition": `attachment; filename="export-${kind}-${entityId.slice(0, 8)}.${format}"`,
    },
  });
});
