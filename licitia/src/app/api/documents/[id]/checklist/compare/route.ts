import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { getChecklist, toChecklistSystems } from "@/core/repositories/checklist.repo";
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
 * POST /api/documents/:id/checklist/compare  (multipart/form-data, campo "file")
 *
 * Compara el checklist del documento base contra el Excel de control. Es una
 * comparación determinista: no llama a ningún proveedor de IA, no consume
 * cuota y responde en el acto.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: doc } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado");

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

    const rows = await getChecklist(supabase, id);
    if (rows.length === 0) {
      throw new ValidationError(
        "El documento base no tiene sistemas identificados. Procésalo primero y revisa su pestaña “Sistemas”."
      );
    }

    let control;
    try {
      control = parseControlWorkbook(Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      // Los problemas de formato son culpa del archivo, no del servidor:
      // se devuelven con el mensaje exacto para que el usuario pueda corregir.
      if (err instanceof ExcelFormatError) throw new ValidationError(err.message);
      throw err;
    }

    const result = compareChecklist(toChecklistSystems(rows), control);

    const { data: saved, error } = await supabase
      .from("checklist_comparisons")
      .insert({
        organization_id: profile.organization_id,
        document_id: id,
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

    await audit(profile.organization_id, user.id, "checklist.compare", "document", id, {
      fileName: file.name,
      extras: result.totals.extra,
    });

    return NextResponse.json({ comparisonId: saved.id, ...result }, { status: 201 });
  }
);
