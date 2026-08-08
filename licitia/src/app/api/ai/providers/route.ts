import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/errors";
import { listConfiguredProviders } from "@/lib/ai-providers";

export const runtime = "nodejs";

/**
 * GET /api/ai/providers
 * Proveedores de IA con API key configurada, para que la interfaz solo
 * ofrezca los motores realmente disponibles (además de "Sin IA", que
 * siempre existe). No expone claves ni URLs, solo id/etiqueta/capacidades.
 */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const providers = listConfiguredProviders().map((p) => ({
    id: p.id,
    label: p.label,
    supportsEmbeddings: p.supportsEmbeddings,
    supportsFiles: p.supportsFiles,
    isPaid: p.isPaid,
  }));
  return NextResponse.json({ providers });
});
