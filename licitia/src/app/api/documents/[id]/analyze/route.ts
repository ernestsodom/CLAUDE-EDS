import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, AppError, ValidationError } from "@/lib/errors";
import { runAnalysisPart, isAnalysisPart, PART_LABELS } from "@/core/services/ingestion.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
// Una parte por llamada, acotada por su propio timeout interno para caber en
// el límite del plan (ver STAGE_TIMEOUT_MS en ingestion.service.ts).
export const maxDuration = 60;

const VALID_MODES: AnalysisMode[] = ["gemini", "groq", "local", "auto"];

/**
 * POST /api/documents/:id/analyze?part=resumen|sistemas|timeline|evaluacion|criticos|chat
 *
 * Ejecuta UNA parte del análisis, a pedido. Reemplaza al encadenado
 * automático de todas las etapas: cada parte se pide por separado, falla por
 * separado y se reintenta por separado.
 *
 * Respuesta: { part, label, done, detail, engine, engineLabel }
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const url = new URL(request.url);
    const part = url.searchParams.get("part") ?? "";
    if (!isAnalysisPart(part)) {
      throw new ValidationError(
        `Parte de análisis desconocida: "${part}". Debe ser una de: resumen, sistemas, timeline, evaluacion, criticos, chat.`
      );
    }

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
      result = await runAnalysisPart({
        documentId: id,
        organizationId: doc.organization_id,
        userId: user.id,
        mode,
        part,
      });
    } catch (err) {
      // Los mensajes del pipeline (cuota agotada, OCR no disponible con el
      // motor elegido, proveedor sin configurar…) son deliberadamente
      // legibles para el usuario: se preservan en vez de ocultarlos tras el
      // "Error interno del servidor" genérico de withErrorHandling.
      throw new AppError(
        err instanceof Error ? err.message : "Error al analizar el documento",
        422,
        "processing_error"
      );
    }

    return NextResponse.json({
      ...result,
      label: PART_LABELS[part],
      engineLabel: result.engine ? ENGINE_LABELS[result.engine] : undefined,
      organizationId: profile.organization_id,
    });
  }
);
