import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { runNextStage, STEP_LABELS } from "@/core/services/ingestion.service";

export const runtime = "nodejs";
// Cada llamada ejecuta UNA etapa acotada, para caber en el límite de
// duración del plan. El cliente repite hasta recibir done=true.
export const maxDuration = 60;

/**
 * POST /api/documents/:id/process
 * Ejecuta la siguiente etapa pendiente del procesamiento del documento.
 * Respuesta: { step, label, done, detail }
 */
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    // El documento debe pertenecer a la organización del usuario y ser visible
    // para él (RLS decide); el procesamiento en sí corre con service_role.
    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado o sin acceso");

    const result = await runNextStage({
      documentId: id,
      organizationId: doc.organization_id,
      userId: user.id,
    });

    return NextResponse.json({
      ...result,
      label: STEP_LABELS[result.step] ?? result.step,
      organizationId: profile.organization_id,
    });
  }
);
