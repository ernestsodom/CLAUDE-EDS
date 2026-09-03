import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, AppError } from "@/lib/errors";
import { runSystemFeatures } from "@/core/services/ingestion.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_MODES: AnalysisMode[] = ["gemini", "groq", "local", "auto"];

/**
 * POST /api/documents/:id/systems/:systemId/features?mode=gemini|groq|local|auto
 *
 * Extrae las funcionalidades de UN sistema puntual — no de todos los del
 * documento (ver runSystemFeatures para el porqué). Es la parte de la que
 * depende el comparador Checklist vs Excel: sin funcionalidades no hay
 * nada que enfrentar contra el Excel de control.
 *
 * Respuesta: { done, detail, engine, engineLabel }
 */
export const POST = withErrorHandling(
  async (
    request: Request,
    { params }: { params: Promise<{ id: string; systemId: string }> }
  ) => {
    const { supabase, user } = await requireUser();
    const { id, systemId } = await params;

    const url = new URL(request.url);
    const modeParam = url.searchParams.get("mode");
    const mode: AnalysisMode = VALID_MODES.includes(modeParam as AnalysisMode)
      ? (modeParam as AnalysisMode)
      : "auto";

    // El documento debe pertenecer a la organización del usuario y ser visible
    // para él (RLS decide); el análisis en sí corre con service_role.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado o sin acceso");

    let result;
    try {
      result = await runSystemFeatures({
        documentId: id,
        systemId,
        organizationId: doc.organization_id,
        userId: user.id,
        mode,
      });
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : "Error al analizar las funcionalidades del sistema",
        422,
        "processing_error"
      );
    }

    return NextResponse.json({
      ...result,
      label: "Funcionalidades",
      engineLabel: result.engine ? ENGINE_LABELS[result.engine] : undefined,
    });
  }
);
