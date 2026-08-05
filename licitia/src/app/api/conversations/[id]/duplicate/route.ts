import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors";
import { duplicateConversation } from "@/core/repositories/conversations.repo";

export const runtime = "nodejs";

/** POST /api/conversations/:id/duplicate — duplica la conversación con sus mensajes. */
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { supabase } = await requireUser();
    const { id } = await params;
    const newId = await duplicateConversation(supabase, id);
    return NextResponse.json({ conversationId: newId }, { status: 201 });
  }
);
