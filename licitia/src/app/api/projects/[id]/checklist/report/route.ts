import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import {
  buildComparisonExcel,
  buildComparisonWordPayload,
  buildComparisonPdf,
  type ChecklistComparison,
} from "@/core/services/checklist.service";
import { exportAs, EXPORT_MIME } from "@/core/services/export.service";

export const runtime = "nodejs";

/**
 * GET /api/projects/:id/checklist/report?comparisonId=X&format=docx|xlsx|pdf
 * Igual que /api/documents/:id/checklist/report, pero para una comparación
 * guardada a nivel de licitación (project_id en vez de document_id).
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    const url = new URL(request.url);
    const comparisonId = url.searchParams.get("comparisonId");
    const format = url.searchParams.get("format");
    if (!comparisonId) throw new ValidationError("Falta comparisonId");
    if (format !== "docx" && format !== "xlsx" && format !== "pdf") {
      throw new ValidationError("format debe ser 'docx', 'xlsx' o 'pdf'");
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();
    if (!project) throw new NotFoundError("Carpeta no encontrada");

    const { data: comparison } = await supabase
      .from("checklist_comparisons")
      .select("result, project_id")
      .eq("id", comparisonId)
      .maybeSingle();
    if (!comparison || comparison.project_id !== id) {
      throw new NotFoundError("Comparación no encontrada para esta carpeta");
    }

    const result = comparison.result as ChecklistComparison;
    const fileBase = `comparacion-${project.name.replace(/[^\w\-]+/g, "-").slice(0, 60)}`;

    if (format === "xlsx") {
      const buffer = buildComparisonExcel(project.name, result);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const buffer = await buildComparisonPdf(project.name, result);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": EXPORT_MIME.pdf,
          "Content-Disposition": `attachment; filename="${fileBase}-ejecutivo.pdf"`,
        },
      });
    }

    const payload = buildComparisonWordPayload(project.name, result);
    const buffer = await exportAs("docx", payload);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": EXPORT_MIME.docx,
        "Content-Disposition": `attachment; filename="${fileBase}.docx"`,
      },
    });
  }
);
