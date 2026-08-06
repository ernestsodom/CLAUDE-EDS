import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { runNextStage, STEP_LABELS } from "@/core/services/ingestion.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/documents/:id/reprocess
 * Reinicia el procesamiento desde la primera etapa y ejecuta ese primer tramo.
 * El cliente continúa con /process hasta completar.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user } = await requireUser();
    const { id } = await params;
    const modeParam = new URL(request.url).searchParams.get("mode");
    const mode = modeParam === "local" || modeParam === "ia" ? modeParam : "auto";

    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado o sin acceso");

    await supabase
      .from("documents")
      .update({ status: "procesando", processing_step: "extraccion_texto", processing_error: null })
      .eq("id", id);

    const result = await runNextStage({
      documentId: id,
      organizationId: doc.organization_id,
      userId: user.id,
      mode,
    });

    return NextResponse.json({ ...result, label: STEP_LABELS[result.step] ?? result.step });
  }
);
