import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { getChecklist, toChecklistSystems } from "@/core/repositories/checklist.repo";
import { buildTemplate } from "@/core/services/checklist.service";

export const runtime = "nodejs";

/**
 * GET /api/documents/:id/checklist/template
 * Excel con el formato predeterminado (docs/formato-excel.md), pre-llenado con
 * el checklist del documento: el usuario solo completa lo entregado.
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    const { data: doc } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado");

    const rows = await getChecklist(supabase, id);
    if (rows.length === 0) {
      throw new ValidationError(
        "Este documento aún no tiene sistemas identificados. Procésalo y revisa la pestaña “Sistemas”."
      );
    }

    const buffer = buildTemplate(doc.title, toChecklistSystems(rows));
    const fileName = `control-entregas-${doc.title.replace(/[^\w\-]+/g, "-").slice(0, 60)}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }
);
