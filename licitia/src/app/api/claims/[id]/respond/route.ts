import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { draftClaimResponse } from "@/core/services/claims.service";
import { MODELS } from "@/lib/openai";
import { audit } from "@/core/services/audit.service";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST /api/claims/:id/respond — redacta la respuesta profesional con citas. */
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: claim } = await supabase.from("claims").select("*").eq("id", id).single();
    if (!claim) throw new NotFoundError("Reclamo no encontrado");
    if (!claim.analysis) throw new NotFoundError("El reclamo aún no tiene análisis");

    const { content, citations } = await draftClaimResponse(
      supabase,
      claim.raw_email,
      claim.analysis,
      claim.client_id
    );

    const { data: response, error } = await supabase
      .from("claim_responses")
      .insert({ claim_id: id, content, citations, model: MODELS.chat })
      .select("id")
      .single();
    if (error || !response) throw new Error(`Error guardando respuesta: ${error?.message}`);

    await supabase.from("claims").update({ status: "respondido" }).eq("id", id);
    await audit(profile.organization_id, user.id, "claim.respond", "claim", id);

    return NextResponse.json(
      { responseId: response.id, content, citations, model: MODELS.chat },
      { status: 201 }
    );
  }
);
