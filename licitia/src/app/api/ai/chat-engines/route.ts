import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors";
import { listChatEngines } from "@/core/services/chat.service";

export const runtime = "nodejs";

/**
 * GET /api/ai/chat-engines
 * Motores disponibles para el Chat IA (Gemini, Groq, Claude), solo los que
 * tienen API key configurada. No expone claves: id y etiqueta.
 */
export const GET = withErrorHandling(async () => {
  await requireUser();
  return NextResponse.json({ engines: listChatEngines() });
});
