import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors";
import { listChatEngines } from "@/core/services/chat.service";

export const runtime = "nodejs";

/**
 * GET /api/ai/chat-engines
 * Motores disponibles para el Chat IA: Gemini, Groq y Claude (solo los que
 * tienen API key configurada) más "local" (búsqueda léxica, sin IA, siempre
 * disponible). A diferencia de /api/ai/providers no incluye "auto": aquí la
 * elección es por conversación y debe ser visible.
 * No expone claves: id, etiqueta y si el proveedor es de pago.
 */
export const GET = withErrorHandling(async () => {
  await requireUser();
  return NextResponse.json({ engines: listChatEngines() });
});
