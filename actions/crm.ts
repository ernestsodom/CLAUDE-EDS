'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { ClientCreateSchema, FollowUpCompleteSchema } from '@/lib/validations/crm';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

/**
 * Alta de cliente.
 *
 * Validacion en tres capas (§84): Zod aqui, constraints en PostgreSQL y
 * RLS decidiendo si la fila puede siquiera insertarse en este proyecto.
 */
export async function createClientRecord(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const projectCode = String(formData.get('projectCode') ?? '');
  const { project, session } = await requireProject(projectCode);

  if (!can(project, 'clients.create')) {
    return failure('No tienes permiso para crear clientes.');
  }

  const parsed = ClientCreateSchema.safeParse({
    company_name: formData.get('company_name'),
    tax_id: formData.get('tax_id') || undefined,
    country: formData.get('country') || undefined,
    city: formData.get('city') || undefined,
    address: formData.get('address') || undefined,
    website: formData.get('website') || undefined,
    status: formData.get('status') || 'PROSPECTO',
    source: formData.get('source') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Revisa los datos introducidos.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...parsed.data,
      project_id: project.id,
      owner_user_id: session.user?.id ?? null,
      created_by: session.user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/comercial/clientes`);
  redirect(`/${projectCode}/comercial/clientes/${data.id}`);
}

/** Cierra un seguimiento y registra el resultado. */
export async function completeFollowUp(input: unknown): Promise<ActionResult<null>> {
  const parsed = FollowUpCompleteSchema.safeParse(input);
  if (!parsed.success) return failure('Datos invalidos');

  const { projectCode, followUpId, result } = parsed.data;
  const { project, session } = await requireProject(projectCode);

  if (!can(project, 'follow_ups.update')) {
    return failure('No tienes permiso para cerrar seguimientos.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('follow_ups')
    .update({
      status: 'COMPLETADO',
      result: result || null,
      completed_at: new Date().toISOString(),
      completed_by: session.user?.id ?? null,
    })
    .eq('id', followUpId);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/comercial/seguimientos`);
  revalidatePath(`/${projectCode}/dashboard`);
  return success(null, 'Seguimiento completado.');
}
