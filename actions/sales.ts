'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import type { ActionResult } from '@/actions/types';
import { failure, success, toUserMessage } from '@/actions/types';

const ConfirmSaleSchema = z.object({
  projectCode: z.string().min(1),
  saleId: z.string().uuid('Identificador de venta invalido'),
  createManufacturing: z.boolean().default(true),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida')
    .optional()
    .or(z.literal('')),
});

/**
 * Confirma una venta (§55, §101).
 *
 * La accion NO reimplementa la logica: invoca `confirm_sale()` en
 * PostgreSQL, que crea canchas, fabricacion, costos estimados y
 * checklists en una sola transaccion. Si algo falla, no queda nada a medias.
 *
 * La comprobacion de permiso aqui sirve para dar un mensaje util; la
 * autorizacion real la vuelve a hacer la funcion en la base.
 */
export async function confirmSale(input: unknown): Promise<ActionResult<{ courts: number }>> {
  const parsed = ConfirmSaleSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Datos invalidos');
  }
  const { projectCode, saleId, createManufacturing, deliveryDate } = parsed.data;

  const { project } = await requireProject(projectCode);
  if (!can(project, 'sales.approve')) {
    return failure('No tienes permiso para confirmar ventas.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_sale', {
    p_sale_id: saleId,
    p_create_manufacturing: createManufacturing,
    p_delivery_date: deliveryDate ? deliveryDate : null,
  });

  if (error) return failure(toUserMessage(error.message));

  const result = data as { courts_created?: number } | null;

  revalidatePath(`/${projectCode}/ventas/${saleId}`);
  revalidatePath(`/${projectCode}/ventas`);
  revalidatePath(`/${projectCode}/dashboard`);
  revalidatePath(`/${projectCode}/operaciones/canchas`);

  return success(
    { courts: result?.courts_created ?? 0 },
    `Venta confirmada. Se generaron ${result?.courts_created ?? 0} canchas y su plan de fabricacion.`,
  );
}

const SnapshotSchema = z.object({
  projectCode: z.string().min(1),
  saleId: z.string().uuid(),
  reason: z.string().min(1).max(60).default('MANUAL'),
});

/** Congela el margen actual de la venta como registro historico (§22). */
export async function snapshotMargin(input: unknown): Promise<ActionResult<null>> {
  const parsed = SnapshotSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, saleId, reason } = parsed.data;
  const { project } = await requireProject(projectCode);
  if (!can(project, 'profitability.view')) {
    return failure('No tienes permiso para gestionar la rentabilidad.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('snapshot_sale_margin', {
    p_sale_id: saleId,
    p_reason: reason,
  });

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/ventas/${saleId}`);
  return success(null, 'Margen congelado correctamente.');
}
