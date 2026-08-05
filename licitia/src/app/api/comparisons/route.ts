import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import {
  runComplianceComparison,
  runDiffComparison,
} from "@/core/services/comparison.service";
import { audit } from "@/core/services/audit.service";

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
});

/**
 * POST /api/comparisons — crea y ejecuta una comparación.
 * 'cumplimiento' → tabla requerimiento a requerimiento con semáforo.
 * resto → detección de diferencias entre documentos.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const body = parsed.data;

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

  if (body.comparisonType === "cumplimiento") {
    await runComplianceComparison(comparison.id);
  } else {
    await runDiffComparison(comparison.id);
  }

  return NextResponse.json({ comparisonId: comparison.id }, { status: 201 });
});
