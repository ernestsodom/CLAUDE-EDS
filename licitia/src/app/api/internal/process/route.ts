import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { withErrorHandling, UnauthorizedError, ValidationError } from "@/lib/errors";
import { processDocumentFully } from "@/core/services/ingestion.service";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  documentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid().nullable().default(null),
});

/**
 * POST /api/internal/process — ejecuta TODAS las etapas seguidas.
 * Pensado para entornos sin límite estricto de duración (plan Pro o una cola
 * externa). En el plan Hobby el cliente usa /api/documents/:id/process, que
 * avanza una etapa por petición.
 * Protegido por INTERNAL_API_SECRET.
 */
export const POST = withErrorHandling(async (request: Request) => {
  if (request.headers.get("x-internal-secret") !== env().INTERNAL_API_SECRET) {
    throw new UnauthorizedError("Secreto interno inválido");
  }
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);

  await processDocumentFully(parsed.data);
  return NextResponse.json({ ok: true });
});
