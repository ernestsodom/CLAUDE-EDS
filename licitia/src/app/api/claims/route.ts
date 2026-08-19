import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import { analyzeClaim, claimProviderFor } from "@/core/services/claims.service";
import { ALL_PROVIDERS, type AnalysisMode } from "@/lib/ai-providers";
import { audit } from "@/core/services/audit.service";
import { usageLogger } from "@/core/services/ai-usage.service";

export const runtime = "nodejs";
export const maxDuration = 180;

const BodySchema = z.object({
  rawEmail: z.string().min(20).max(50000),
  clientId: z.string().uuid().nullable().default(null),
  contractDocumentId: z.string().uuid().nullable().default(null),
  subject: z.string().max(300).optional(),
  mode: z.enum(ALL_PROVIDERS as [string, ...string[]]).optional(),
});

/** POST /api/claims — registra un reclamo y ejecuta el análisis IA con evidencia. */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const body = parsed.data;

  const provider = claimProviderFor(body.mode as AnalysisMode | undefined);
  const onUsage = usageLogger({
    organizationId: profile.organization_id,
    documentId: body.contractDocumentId,
    userId: user.id,
    feature: "reclamo_analisis",
  });
  const { analysis } = await analyzeClaim(supabase, body.rawEmail, body.clientId, provider, onUsage);

  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      organization_id: profile.organization_id,
      client_id: body.clientId,
      contract_document_id: body.contractDocumentId,
      subject: body.subject ?? analysis.que_reclama.slice(0, 200),
      raw_email: body.rawEmail,
      status: "analizado",
      analysis,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !claim) throw new Error(`Error guardando reclamo: ${error?.message}`);

  await audit(profile.organization_id, user.id, "claim.analyze", "claim", claim.id);
  return NextResponse.json({ claimId: claim.id, analysis }, { status: 201 });
});
