import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { withErrorHandling, UnauthorizedError, ValidationError } from "@/lib/errors";
import { processDocument } from "@/core/services/ingestion.service";

export const runtime = "nodejs";
// Pipeline completo (OCR + análisis IA) puede tardar varios minutos.
export const maxDuration = 300;

const BodySchema = z.object({
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
});

/**
 * POST /api/internal/process — ejecuta el pipeline de ingesta con service_role.
 * Protegido por INTERNAL_API_SECRET (solo invocable por el propio backend).
 */
export const POST = withErrorHandling(async (request: Request) => {
  if (request.headers.get("x-internal-secret") !== env().INTERNAL_API_SECRET) {
    throw new UnauthorizedError("Secreto interno inválido");
  }
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);

  await processDocument(parsed.data);
  return NextResponse.json({ ok: true });
});
