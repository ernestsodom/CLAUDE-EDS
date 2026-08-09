'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
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
