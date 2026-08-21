import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import {
  runComplianceComparison,
  runDiffComparison,
} from "@/core/services/comparison.service";
import { audit } from "@/core/services/audit.service";
import { ALL_PROVIDERS, type AnalysisMode } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  comparisonType: z.enum([
    "cumplimiento",
    "licitacion_vs_licitacion",
    "propuesta_vs_propuesta",
    "contrato_vs_contrato",
    "version_vs_version",
  ]),
  sourceDocumentId: z.string().uuid(),
  targetDocumentId: z.string().uuid(),
  // Motor elegido por el usuario. 'cumplimiento' necesita un modelo que
  // interprete evidencia, así que ahí solo se aceptan proveedores concretos
  // ('auto' y 'local' no aplican). Comparar dos documentos SÍ admite 'local'
  // (diff léxico sin IA); 'auto' sigue sin aplicar ahí tampoco.
  mode: z.enum([...ALL_PROVIDERS, "local"] as unknown as [string, ...string[]]).optional(),
});

/**
 * POST /api/comparisons — crea y ejecuta una comparación.
 * 'cumplimiento' → tabla requerimiento a requerimiento con semáforo (siempre con IA).
 * resto → detección de diferencias entre documentos (con IA, o 'local' sin IA).
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const body = parsed.data;

  if (body.comparisonType === "cumplimiento" && body.mode === "local") {
    throw new ValidationError(
      "El motor local no aplica a 'Control de cumplimiento': esa comparación necesita interpretar evidencia con un modelo. Úsalo en 'Comparar dos documentos'."
    );
  }

  const { data: comparison, error } = await supabase
    .from("comparisons")
    .insert({
      organization_id: profile.organization_id,
      comparison_type: body.comparisonType,
      source_document_id: body.sourceDocumentId,
      target_document_id: body.targetDocumentId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !comparison) throw new Error(`Error creando comparación: ${error?.message}`);

  await audit(profile.organization_id, user.id, "comparison.create", "comparison", comparison.id);

  const mode = body.mode as AnalysisMode | undefined;
  if (body.comparisonType === "cumplimiento") {
    await runComplianceComparison(comparison.id, mode);
  } else {
    await runDiffComparison(comparison.id, mode);
  }

  return NextResponse.json({ comparisonId: comparison.id }, { status: 201 });
});
