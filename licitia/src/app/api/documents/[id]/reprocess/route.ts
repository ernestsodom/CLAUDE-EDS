import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, NotFoundError } from "@/lib/errors";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** POST /api/documents/:id/reprocess — reintenta el pipeline para la versión actual. */
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase, user, profile } = await requireUser();
    const { id } = await params;

    const { data: version } = await supabase
      .from("document_versions")
      .select("id")
      .eq("document_id", id)
      .eq("is_current", true)
      .single();
    if (!version) throw new NotFoundError("Versión actual no encontrada");

    await fetch(`${env().NEXT_PUBLIC_APP_URL}/api/internal/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": env().INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        documentId: id,
        versionId: version.id,
        organizationId: profile.organization_id,
        userId: user.id,
      }),
    });

    return NextResponse.json({ status: "procesando" });
  }
);
