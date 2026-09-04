import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { getProjectChecklist, toChecklistSystems } from "@/core/repositories/checklist.repo";
import {
  compareChecklist,
  ExcelFormatError,
  parseControlWorkbook,
} from "@/core/services/checklist.service";
import { audit } from "@/core/services/audit.service";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/projects/:id/checklist/compare  (multipart/form-data, campo "file")
 *
 * Igual que /api/documents/:id/checklist/compare, pero contra el checklist
 * consolidado de TODOS los documentos de la carpeta (getProjectChecklist) —
 * el comparador a nivel de licitación completa, no de un solo documento.
 * Misma comparación determinista, sin IA.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();
    if (!project) throw new NotFoundError("Carpeta no encontrada");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ValidationError("Falta el archivo Excel (campo 'file')");
    if (!/\.xlsx$/i.test(file.name)) {
      throw new ValidationError(
        `El archivo debe ser un Excel .xlsx (recibido: ${file.name}). ` +
          "Descarga la plantilla desde el comparador si no la tienes."
      );
    }
    if (file.size > env().MAX_UPLOAD_MB * 1024 * 1024) {
      throw new ValidationError(`El archivo supera el máximo de ${env().MAX_UPLOAD_MB} MB`);
    }

    const rows = await getProjectChecklist(supabase, id);
    if (rows.length === 0) {
      throw new ValidationError(
        "Esta carpeta no tiene sistemas identificados en ninguno de sus documentos todavía."
      );
    }

    let control;
    try {
      control = parseControlWorkbook(Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof ExcelFormatError) throw new ValidationError(err.message);
      throw err;
    }

    const result = compareChecklist(toChecklistSystems(rows), control);

    const { data: saved, error } = await supabase
      .from("checklist_comparisons")
      .insert({
        organization_id: profile.organization_id,
        project_id: id,
        file_name: file.name,
        total_features: result.totals.totalFeatures,
        matched: result.totals.matched,
        completed: result.totals.completed,
        missing: result.totals.missing,
        extra: result.totals.extra,
        pct_completed: result.totals.pctCompleted,
        result,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Error guardando la comparación: ${error.message}`);

    await audit(profile.organization_id, user.id, "checklist.compare", "project", id, {
      fileName: file.name,
      extras: result.totals.extra,
    });

    return NextResponse.json({ comparisonId: saved.id, ...result }, { status: 201 });
  }
);
