import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import { buildComparativeRows, buildComparativeWorkbook } from "@/core/services/comparative-matrix.service";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(2, "Elige al menos 2 documentos para comparar."),
});

/**
 * POST /api/documents/comparative-export
 * Cuadro comparativo de varias licitaciones en un solo Excel: una fila por
 * documento con número de licitación, cliente, software solicitado, plazos,
 * presupuesto, servidores, multas, SLA, experiencia, migración,
 * certificaciones y pauta de evaluación — ensamblado desde lo que ya quedó
 * extraído al procesar cada documento (RLS del cliente del usuario decide
 * qué puede ver; no se usa el cliente admin acá).
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Solicitud inválida");

  const rows = await buildComparativeRows(supabase, parsed.data.documentIds);
  if (rows.length === 0) {
    throw new ValidationError("No se encontró ninguno de los documentos seleccionados, o no tienes acceso a ellos.");
  }

  const buffer = buildComparativeWorkbook(rows);
  const fileName = `cuadro-comparativo-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
