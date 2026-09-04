import { NextResponse } from "next/server";
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
 * GET /api/documents/:id/checklist/report?comparisonId=X&format=docx|xlsx|pdf
 *
 * Informe de UNA comparación ya calculada (guardada por /checklist/compare
 * en checklist_comparisons) — no vuelve a leer ningún Excel, solo formatea
 * el resultado guardado: Word/Excel para el detalle completo, PDF para el
 * informe ejecutivo con gráficos (torta de estado global + barras por
 * sistema).
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

    const { data: doc } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado");

    const { data: comparison } = await supabase
      .from("checklist_comparisons")
      .select("result, document_id")
      .eq("id", comparisonId)
      .maybeSingle();
    if (!comparison || comparison.document_id !== id) {
      throw new NotFoundError("Comparación no encontrada para este documento");
    }

    const result = comparison.result as ChecklistComparison;
    const fileBase = `comparacion-${doc.title.replace(/[^\w\-]+/g, "-").slice(0, 60)}`;

    if (format === "xlsx") {
      const buffer = buildComparisonExcel(doc.title, result);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const buffer = await buildComparisonPdf(doc.title, result);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": EXPORT_MIME.pdf,
          "Content-Disposition": `attachment; filename="${fileBase}-ejecutivo.pdf"`,
        },
      });
    }

    const payload = buildComparisonWordPayload(doc.title, result);
    const buffer = await exportAs("docx", payload);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": EXPORT_MIME.docx,
        "Content-Disposition": `attachment; filename="${fileBase}.docx"`,
      },
    });
  }
);
