'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import { SaleCostSchema, SaleItemSchema, SaleSchema } from '@/lib/validations/operations';
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

// =====================================================================
// Alta y edicion de ventas
//
// El formulario NO envia subtotal, discount, tax ni total: los calcula un
// trigger a partir de `sale_items`. Es la unica forma de garantizar que la
// cabecera y el detalle no puedan discrepar.
// =====================================================================
type FormState = ActionResult<{ id: string }> | null;

function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

export async function saveSale(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'sales',
    module: 'sales',
    id,
    schema: SaleSchema,
    raw: formToObject(formData),
    extra: { salesperson_id: (await requireProject(projectCode)).session.user?.id ?? null },
    revalidate: [`/${projectCode}/ventas`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/ventas/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/ventas/${id}`);
  return result;
}

export async function deleteSale(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'sales', id, module: 'sales',
    revalidate: [`/${projectCode}/ventas`, `/${projectCode}/dashboard`],
  });
}

export async function saveSaleItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const saleId = String(formData.get('sale_id') ?? '');

  return persistRecord({
    projectCode,
    table: 'sale_items',
    module: 'sales',
    id,
    schema: SaleItemSchema,
    raw: formToObject(formData),
    stamp: {},
    extra: { sale_id: saleId },
    revalidate: [`/${projectCode}/ventas/${saleId}`, `/${projectCode}/ventas`],
    successMessage: 'Linea guardada. El total de la venta se ha recalculado.',
  });
}

export async function deleteSaleItem(
  projectCode: string, id: string, saleId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'sales.update')) {
    return failure('No tienes permiso para modificar ventas.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('sale_items').delete().eq('id', id);
  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/ventas/${saleId}`);
  return success(null, 'Linea eliminada.');
}

export async function saveSaleCost(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const saleId = String(formData.get('sale_id') ?? '');

  return persistRecord({
    projectCode,
    table: 'sale_costs',
    module: 'sales',
    id,
    schema: SaleCostSchema,
    raw: formToObject(formData),
    extra: { sale_id: saleId },
    revalidate: [
      `/${projectCode}/ventas/${saleId}`,
      `/${projectCode}/finanzas/rentabilidad`,
      `/${projectCode}/dashboard`,
    ],
    successMessage: 'Costo guardado. El margen se ha recalculado.',
  });
}

export async function deleteSaleCost(
  projectCode: string, id: string, saleId: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'sale_costs', id, module: 'sales',
    revalidate: [`/${projectCode}/ventas/${saleId}`, `/${projectCode}/finanzas/rentabilidad`],
  });
}
