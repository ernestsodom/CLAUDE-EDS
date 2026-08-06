import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, AppError } from "@/lib/errors";
import { runNextStage, STEP_LABELS } from "@/core/services/ingestion.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_MODES: AnalysisMode[] = ["gemini", "groq", "local", "auto"];

/**
 * POST /api/documents/:id/reprocess?mode=gemini|groq|local|auto
 * Reinicia el procesamiento desde la primera etapa y ejecuta ese primer tramo.
 * El cliente continúa con /process hasta completar.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user } = await requireUser();
    const { id } = await params;
    const modeParam = new URL(request.url).searchParams.get("mode");
    const mode: AnalysisMode = VALID_MODES.includes(modeParam as AnalysisMode)
      ? (modeParam as AnalysisMode)
      : "auto";

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

    let result;
    try {
      result = await runNextStage({
        documentId: id,
        organizationId: doc.organization_id,
        userId: user.id,
        mode,
      });
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : "Error al procesar el documento",
        422,
        "processing_error"
      );
    }

    return NextResponse.json({
      ...result,
      label: STEP_LABELS[result.step] ?? result.step,
      engineLabel: result.engine ? ENGINE_LABELS[result.engine] : undefined,
    });
  }
);
