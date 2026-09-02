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
    const iso = (norma: string, c: { exigida: boolean | null; detalle: string | null } | null) =>
      `${norma}: ${c?.exigida ? "exigida" : c?.exigida === false ? "no exigida" : "no mencionada en el documento"}` +
      `${c?.detalle ? ` — ${c.detalle}` : ""}`;
    const migracion = s.data_migration as
      | { exigida: boolean | null; plazo: string | null; volumen: string | null; detalle: string | null }
      | null;
    payload = {
      title: `Resumen — ${s.documents?.title ?? ""}`,
      sections: [
        { title: "Resumen general", paragraphs: [s.summary ?? ""] },
        { title: "Objetivo", paragraphs: [s.objective ?? ""] },
        { title: "Alcance", paragraphs: [s.scope ?? ""] },
        {
          title: "Plazo y presupuesto",
          paragraphs: [
            `Plazo de implementación: ${s.implementation_deadline ?? "no especificado en el documento"}`,
            s.budget_amount != null
              ? `Presupuesto: ${s.budget_amount} ${s.budget_currency ?? ""} (${s.budget_period ?? "sin periodicidad indicada"})${s.budget_detail ? ` — ${s.budget_detail}` : ""}`
              : "Presupuesto: no especificado en el documento",
          ],
        },
        { title: "Obligaciones", paragraphs: list(s.obligations) },
        { title: "Restricciones", paragraphs: list(s.restrictions) },
        {
          title: "Certificaciones",
          paragraphs: [iso("ISO 9001", s.iso_9001), iso("ISO 27001", s.iso_27001)],
        },
        {
          title: "Migración de datos",
          paragraphs: [
            migracion?.exigida
              ? [
                  "Exigida",
                  migracion.plazo ? `Plazo: ${migracion.plazo}` : null,
                  migracion.volumen ? `Volumen: ${migracion.volumen}` : null,
                  migracion.detalle,
                ]
                  .filter(Boolean)
                  .join(" — ")
              : migracion?.exigida === false
                ? "No exigida"
                : "No mencionada en el documento",
          ],
        },
      ],
    };
  } else if (kind === "comparacion") {
    const { data: cmp } = await supabase
      .from("comparisons")
      .select("*, comparison_items(*)")
      .eq("id", entityId)
      .maybeSingle();
    if (!cmp) throw new NotFoundError("Comparación no encontrada");

    if (cmp.comparison_type === "cumplimiento") {
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
      // Diferencias entre dos documentos: resumen macro + detalle punto por
      // punto con la página de origen en cada documento.
      const points = (cmp.summary_points ?? []) as string[];
      payload = {
        title: "Informe de Diferencias entre Documentos",
        sections: [
          { title: "Resumen macro", paragraphs: [cmp.summary ?? "", ...points.map((p) => `• ${p}`)] },
        ],
        table: {
          headers: ["Tema", "Punto/Sección", "Documento A", "Pág. A", "Documento B", "Pág. B", "Impacto", "Comentario"],
          rows: ((cmp.differences ?? []) as Array<Record<string, unknown>>).map((d) => [
            String(d.tema ?? ""),
            String(d.seccion ?? ""),
            String(d.documento_a ?? ""),
            String(d.pagina_a ?? ""),
            String(d.documento_b ?? ""),
            String(d.pagina_b ?? ""),
            String(d.impacto ?? ""),
            String(d.comentario ?? ""),
          ]),
        },
      };
    }
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
