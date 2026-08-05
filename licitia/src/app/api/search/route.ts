import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import { retrieve, fetchDocTitles } from "@/core/services/rag.service";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  query: z.string().min(2).max(500),
  docType: z.string().optional(),
  clientId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** POST /api/search — búsqueda híbrida (semántica + texto) sobre la biblioteca autorizada. */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const { query, docType, clientId, limit } = parsed.data;

  const results = await retrieve(
    supabase,
    query,
    { docType: docType as never, clientId },
    limit
  );
  const titles = await fetchDocTitles(supabase, results.map((r) => r.document_id));

  return NextResponse.json({
    results: results.map((r) => ({
      ...r,
      document_title: titles.get(r.document_id) ?? "Documento",
      snippet: r.content.slice(0, 400),
    })),
  });
});
