import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { getProjectChecklist, toChecklistSystems } from "@/core/repositories/checklist.repo";
import { buildTemplate } from "@/core/services/checklist.service";

export const runtime = "nodejs";

/**
 * GET /api/projects/:id/checklist/template
 * Igual que /api/documents/:id/checklist/template, pero uniendo los sistemas
 * de TODOS los documentos de la carpeta — la plantilla de una licitación con
 * varios documentos (bases técnicas, administrativas, anexos…).
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;

    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();
    if (!project) throw new NotFoundError("Carpeta no encontrada");

    const rows = await getProjectChecklist(supabase, id);
    if (rows.length === 0) {
      throw new ValidationError(
        "Esta carpeta aún no tiene sistemas identificados en ninguno de sus documentos."
      );
    }

    const buffer = buildTemplate(project.name, toChecklistSystems(rows));
    const fileName = `control-entregas-${project.name.replace(/[^\w\-]+/g, "-").slice(0, 60)}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }
);
