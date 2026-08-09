'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import {
  CourtSchema, InstallationSchema, ManufacturingProjectSchema, MaterialRequirementSchema,
  PurchaseOrderItemSchema, PurchaseOrderSchema, QualityCheckSchema, ShipmentSchema,
  SupplierSchema,
} from '@/lib/validations/operations';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

const COURT_STATUSES = [
  'PLANIFICADA', 'MATERIALES_PENDIENTES', 'EN_CONSTRUCCION', 'CONSTRUCCION_TERMINADA',
  'GALVANIZADO', 'GALVANIZADO_TERMINADO', 'EMBALAJE', 'EMBALADA',
  'DISPONIBLE', 'RESERVADA', 'EN_DESMONTAJE', 'DESMONTADA', 'EN_REPARACION',
  'PREPARADA', 'EN_TRANSPORTE', 'VENDIDA',
  'EN_TRANSITO', 'EN_INSTALACION', 'INSTALACION_TERMINADA', 'ENTREGADA', 'BAJA',
] as const;

const ChangeCourtStatusSchema = z.object({
  projectCode: z.string().min(1),
  courtId: z.string().uuid(),
  newStatus: z.enum(COURT_STATUSES),
  comment: z.string().max(500).optional(),
});

/**
 * Cambia el estado de una cancha (§74).
 *
 * Delega en `change_court_status()`: la base escribe el historial, emite el
 * evento de timeline y recalcula el estado de entrega de la venta. Hacerlo
 * aqui significaria duplicar esa cadena y arriesgarse a desincronizarla.
 */
export async function changeCourtStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = ChangeCourtStatusSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Datos invalidos');
  }
  const { projectCode, courtId, newStatus, comment } = parsed.data;

  const { project } = await requireProject(projectCode);
  if (!can(project, 'courts.update')) {
    return failure('No tienes permiso para modificar canchas.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('change_court_status', {
    p_court_id: courtId,
    p_new_status: newStatus,
    p_comment: comment || null,
  });

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/operaciones/canchas/${courtId}`);
  revalidatePath(`/${projectCode}/operaciones/canchas`);
  revalidatePath(`/${projectCode}/dashboard`);

  return success(null, 'Estado actualizado.');
}

const ToggleChecklistSchema = z.object({
  projectCode: z.string().min(1),
  itemId: z.string().uuid(),
  completed: z.boolean(),
  revalidate: z.string().optional(),
});

/** Marca o desmarca un item de checklist (§57, §59, §120). */
export async function toggleChecklistItem(input: unknown): Promise<ActionResult<null>> {
  const parsed = ToggleChecklistSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, itemId, completed, revalidate } = parsed.data;
  const { project } = await requireProject(projectCode);
  if (!can(project, 'manufacturing.update')) {
    return failure('No tienes permiso para actualizar el checklist.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('checklist_items')
    .update({ completed })
    .eq('id', itemId);

  if (error) return failure(toUserMessage(error.message));

  if (revalidate) revalidatePath(revalidate);
  return success(null, completed ? 'Item completado.' : 'Item reabierto.');
}

const CreateTaskFromAlertSchema = z.object({
  projectCode: z.string().min(1),
  alertId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});

/** Convierte una alerta en tarea asignable (§116). */
export async function createTaskFromAlert(input: unknown): Promise<ActionResult<null>> {
  const parsed = CreateTaskFromAlertSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, alertId, dueDate } = parsed.data;
  const { project } = await requireProject(projectCode);
  if (!can(project, 'tasks.create')) {
    return failure('No tienes permiso para crear tareas.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_task_from_alert', {
    p_alert_id: alertId,
    p_assigned_to: null,
    p_due_date: dueDate ? dueDate : null,
  });

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/control-center`);
  revalidatePath(`/${projectCode}/tareas`);
  return success(null, 'Tarea creada y asignada.');
}

const AcknowledgeAlertSchema = z.object({
  projectCode: z.string().min(1),
  alertId: z.string().uuid(),
  status: z.enum(['RECONOCIDA', 'EN_GESTION', 'DESCARTADA']),
});

/** Reconoce o descarta una alerta sin crear tarea. */
export async function updateAlertStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = AcknowledgeAlertSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, alertId, status } = parsed.data;
  const { project, session } = await requireProject(projectCode);
  if (!can(project, 'control_center.view')) {
    return failure('No tienes permiso sobre las alertas de este proyecto.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('alerts')
    .update({
      status,
      acknowledged_by: session.user?.id ?? null,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/control-center`);
  return success(null, 'Alerta actualizada.');
}

const CompleteTaskSchema = z.object({
  projectCode: z.string().min(1),
  taskId: z.string().uuid(),
  status: z.enum(['PENDIENTE', 'EN_CURSO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA']),
});

export async function updateTaskStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = CompleteTaskSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, taskId, status } = parsed.data;
  const { project } = await requireProject(projectCode);
  if (!can(project, 'tasks.update')) {
    return failure('No tienes permiso para actualizar tareas.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/tareas`);
  revalidatePath(`/${projectCode}/control-center`);
  return success(null, 'Tarea actualizada.');
}

// =====================================================================
// Alta y edicion de entidades operacionales
// =====================================================================
type FormState = ActionResult<{ id: string }> | null;

function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

// ---------------------------------------------------------------- Fabricacion
export async function saveManufacturingProject(
  _prev: FormState, formData: FormData,
): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'manufacturing_projects',
    module: 'manufacturing',
    id,
    schema: ManufacturingProjectSchema,
    raw: formToObject(formData),
    extra: { responsible_user_id: (await requireProject(projectCode)).session.user?.id ?? null },
    revalidate: [`/${projectCode}/operaciones/fabricacion`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/fabricacion/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/operaciones/fabricacion/${id}`);
  return result;
}

export async function deleteManufacturingProject(
  projectCode: string, id: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'manufacturing_projects', id, module: 'manufacturing',
    revalidate: [`/${projectCode}/operaciones/fabricacion`],
  });
}

// -------------------------------------------------------------------- Canchas
export async function saveCourt(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'courts',
    module: 'courts',
    id,
    schema: CourtSchema,
    raw: formToObject(formData, { booleans: ['has_lighting'] }),
    revalidate: [`/${projectCode}/operaciones/canchas`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/canchas/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/operaciones/canchas/${id}`);
  return result;
}

export async function deleteCourt(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'courts', id, module: 'courts',
    revalidate: [`/${projectCode}/operaciones/canchas`],
  });
}

// ----------------------------------------------------------------- Materiales
export async function saveMaterialRequirement(
  _prev: FormState, formData: FormData,
): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'material_requirements',
    module: 'materials',
    id,
    schema: MaterialRequirementSchema,
    raw: formToObject(formData),
    stamp: {},
    revalidate: [`/${projectCode}/operaciones/materiales`, `/${projectCode}/dashboard`],
    successMessage: 'Requerimiento guardado. El faltante se ha recalculado.',
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/materiales`);
  return result;
}

// ---------------------------------------------------------------- Proveedores
export async function saveSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'suppliers',
    module: 'suppliers',
    id,
    schema: SupplierSchema,
    raw: formToObject(formData),
    stamp: {},
    revalidate: [`/${projectCode}/operaciones/proveedores`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/proveedores`);
  return result;
}

export async function deleteSupplier(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'suppliers', id, module: 'suppliers',
    revalidate: [`/${projectCode}/operaciones/proveedores`],
  });
}

// ----------------------------------------------------------- Ordenes de compra
export async function savePurchaseOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'purchase_orders',
    module: 'purchases',
    id,
    schema: PurchaseOrderSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/operaciones/compras`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/compras/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/operaciones/compras/${id}`);
  return result;
}

export async function savePurchaseOrderItem(
  _prev: FormState, formData: FormData,
): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const poId = String(formData.get('purchase_order_id') ?? '');

  return persistRecord({
    projectCode,
    table: 'purchase_order_items',
    module: 'purchases',
    id,
    schema: PurchaseOrderItemSchema,
    raw: formToObject(formData),
    stamp: {},
    extra: { purchase_order_id: poId },
    revalidate: [`/${projectCode}/operaciones/compras/${poId}`],
    successMessage: 'Linea guardada. El total de la orden se ha recalculado.',
  });
}

export async function deletePurchaseOrderItem(
  projectCode: string, id: string, poId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'purchases.update')) {
    return failure('No tienes permiso para modificar ordenes de compra.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('purchase_order_items').delete().eq('id', id);
  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/operaciones/compras/${poId}`);
  return success(null, 'Linea eliminada.');
}

// ------------------------------------------------------------------ Logistica
export async function saveShipment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'shipments',
    module: 'logistics',
    id,
    schema: ShipmentSchema,
    raw: formToObject(formData),
    revalidate: [
      `/${projectCode}/operaciones/logistica`,
      `/${projectCode}/dashboard`,
      `/${projectCode}/hoy`,
    ],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/logistica/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/operaciones/logistica/${id}`);
  return result;
}

export async function deleteShipment(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'shipments', id, module: 'logistics',
    revalidate: [`/${projectCode}/operaciones/logistica`],
  });
}

// -------------------------------------------------------------- Instalaciones
export async function saveInstallation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'installations',
    module: 'installations',
    id,
    schema: InstallationSchema,
    raw: formToObject(formData),
    extra: { responsible_user_id: (await requireProject(projectCode)).session.user?.id ?? null },
    revalidate: [
      `/${projectCode}/operaciones/instalaciones`,
      `/${projectCode}/hoy`,
      `/${projectCode}/dashboard`,
    ],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/instalaciones/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/operaciones/instalaciones/${id}`);
  return result;
}

export async function deleteInstallation(
  projectCode: string, id: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'installations', id, module: 'installations',
    revalidate: [`/${projectCode}/operaciones/instalaciones`],
  });
}

// -------------------------------------------------------------------- Calidad
export async function saveQualityCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'quality_checks',
    module: 'quality',
    id,
    schema: QualityCheckSchema,
    raw: formToObject(formData),
    stamp: {},
    extra: { responsible_user_id: (await requireProject(projectCode)).session.user?.id ?? null },
    revalidate: [`/${projectCode}/operaciones/calidad`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/operaciones/calidad`);
  return result;
}
