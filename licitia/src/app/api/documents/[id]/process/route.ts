import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, AppError } from "@/lib/errors";
import { runNextStage, STEP_LABELS } from "@/core/services/ingestion.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
// Cada llamada ejecuta UNA etapa acotada, para caber en el límite de
// duración del plan. El cliente repite hasta recibir done=true.
export const maxDuration = 60;

const VALID_MODES: AnalysisMode[] = ["gemini", "groq", "local", "auto"];

/**
 * POST /api/documents/:id/process?mode=gemini|groq|local|auto
 * Ejecuta la siguiente etapa pendiente del procesamiento del documento con
 * el motor elegido explícitamente por el usuario.
 * Respuesta: { step, label, done, detail, engine, engineLabel }
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;
    const modeParam = new URL(request.url).searchParams.get("mode");
    const mode: AnalysisMode = VALID_MODES.includes(modeParam as AnalysisMode)
      ? (modeParam as AnalysisMode)
      : "auto";

    // El documento debe pertenecer a la organización del usuario y ser visible
    // para él (RLS decide); el procesamiento en sí corre con service_role.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado o sin acceso");

    let result;
    try {
      result = await runNextStage({
        documentId: id,
        organizationId: doc.organization_id,
        userId: user.id,
        mode,
      });
    } catch (err) {
      // Los mensajes del pipeline (cuota agotada, OCR no disponible con el
      // motor elegido, proveedor sin configurar…) son deliberadamente
      // legibles para el usuario: se preservan en vez de ocultarlos tras el
      // "Error interno del servidor" genérico de withErrorHandling.
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
      organizationId: profile.organization_id,
    });
  }
);
