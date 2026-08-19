import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { draftClaimResponse, claimProviderFor } from "@/core/services/claims.service";
import { ALL_PROVIDERS, type AnalysisMode } from "@/lib/ai-providers";
import { audit } from "@/core/services/audit.service";
import { usageLogger } from "@/core/services/ai-usage.service";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST /api/claims/:id/respond — redacta la respuesta profesional con citas. */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    // El motor viaja en el cuerpo, opcional: la pantalla puede pedir la
    // redacción sin cuerpo y entonces se usa el proveedor por defecto.
    const raw = await request.json().catch(() => ({}));
    const mode = ALL_PROVIDERS.includes(raw?.mode) ? (raw.mode as AnalysisMode) : undefined;
    const provider = claimProviderFor(mode);

    const { data: claim } = await supabase.from("claims").select("*").eq("id", id).single();
    if (!claim) throw new NotFoundError("Reclamo no encontrado");
    if (!claim.analysis) throw new NotFoundError("El reclamo aún no tiene análisis");

    const onUsage = usageLogger({
      organizationId: profile.organization_id,
      documentId: claim.contract_document_id,
      userId: user.id,
      feature: "reclamo_respuesta",
    });
    const { content, citations, model } = await draftClaimResponse(
      supabase,
      claim.raw_email,
      claim.analysis,
      claim.client_id,
      provider,
      onUsage
    );

    const { data: response, error } = await supabase
      .from("claim_responses")
      .insert({ claim_id: id, content, citations, model })
      .select("id")
      .single();
    if (error || !response) throw new Error(`Error guardando respuesta: ${error?.message}`);

    await supabase.from("claims").update({ status: "respondido" }).eq("id", id);
    await audit(profile.organization_id, user.id, "claim.respond", "claim", id);

    return NextResponse.json(
      { responseId: response.id, content, citations, model },
      { status: 201 }
    );
  }
);
