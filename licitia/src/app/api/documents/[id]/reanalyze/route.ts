import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError, ValidationError } from "@/lib/errors";
import { createNewVersion, copyCurrentFileToVersion } from "@/core/repositories/documents.repo";
import { audit } from "@/core/services/audit.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_MODES: AnalysisMode[] = ["gemini", "groq", "claude", "local", "auto"];

/**
 * POST /api/documents/:id/reanalyze  (body: { mode })
 * Crea una versión nueva del documento (mismo archivo, sin volver a subirlo)
 * y la deja lista para procesarse con el motor elegido — sin pisar el
 * análisis anterior, que queda accesible desde la pestaña Versiones.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user } = await requireUser();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const mode: AnalysisMode = VALID_MODES.includes(body?.mode) ? body.mode : "auto";

    const { data: doc } = await supabase
      .from("documents")
      .select("id, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (!doc) throw new NotFoundError("Documento no encontrado o sin acceso");

    const { data: currentVersion } = await supabase
      .from("document_versions")
      .select("id")
      .eq("document_id", id)
      .eq("is_current", true)
      .maybeSingle();
    if (!currentVersion) throw new ValidationError("El documento no tiene una versión activa que reanalizar");

    const version = await createNewVersion(
      supabase,
      id,
      user.id,
      `Reanálisis con ${ENGINE_LABELS[mode]}`,
      mode
    );
    await copyCurrentFileToVersion(supabase, id, version.id as string);

    await supabase
      .from("documents")
      .update({ status: "procesando", processing_step: "extraccion_texto", processing_error: null })
      .eq("id", id);

    await audit(doc.organization_id, user.id, "document.reanalyze", "document", id, {
      versionId: version.id,
      mode,
    });

    return NextResponse.json({ versionId: version.id, version: version.version });
  }
);
