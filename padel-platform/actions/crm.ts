'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import {
  ActivitySchema, ClientSchema, ContactSchema, FollowUpCompleteSchema,
  FollowUpSchema, MeetingSchema, OpportunitySchema,
} from '@/lib/validations/commercial';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

type FormState = ActionResult<{ id: string }> | null;

/** Lee el contexto que todo formulario envia en campos ocultos. */
function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

// =====================================================================
// Clientes
// =====================================================================
export async function saveClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'clients',
    module: 'clients',
    id,
    schema: ClientSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/comercial/clientes`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/comercial/clientes/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/comercial/clientes/${id}`);
  return result;
}

export async function deleteClient(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'clients', id, module: 'clients',
    revalidate: [`/${projectCode}/comercial/clientes`],
  });
}

// =====================================================================
// Contactos
// =====================================================================
export async function saveContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const clientId = String(formData.get('client_id') ?? '');

  const result = await persistRecord({
    projectCode,
    table: 'contacts',
    module: 'contacts',
    id,
    schema: ContactSchema,
    raw: formToObject(formData, { booleans: ['is_primary'] }),
    stamp: {},
    revalidate: [`/${projectCode}/comercial/clientes/${clientId}`],
  });

  return result;
}

export async function deleteContact(
  projectCode: string, id: string, clientId: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'contacts', id, module: 'contacts',
    revalidate: [`/${projectCode}/comercial/clientes/${clientId}`],
  });
}

// =====================================================================
// Oportunidades
// =====================================================================
export async function saveOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'opportunities',
    module: 'opportunities',
    id,
    schema: OpportunitySchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/comercial/oportunidades`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/comercial/oportunidades`);
  return result;
}

export async function deleteOpportunity(
  projectCode: string, id: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'opportunities', id, module: 'opportunities',
    revalidate: [`/${projectCode}/comercial/oportunidades`],
  });
}

// =====================================================================
// Reuniones
// =====================================================================
export async function saveMeeting(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'meetings',
    module: 'meetings',
    id,
    schema: MeetingSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/comercial/reuniones`, `/${projectCode}/hoy`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/comercial/reuniones`);
  return result;
}

export async function deleteMeeting(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'meetings', id, module: 'meetings',
    revalidate: [`/${projectCode}/comercial/reuniones`],
  });
}

// =====================================================================
// Seguimientos
// =====================================================================
export async function saveFollowUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'follow_ups',
    module: 'follow_ups',
    id,
    schema: FollowUpSchema,
    raw: formToObject(formData),
    revalidate: [
      `/${projectCode}/comercial/seguimientos`,
      `/${projectCode}/hoy`,
      `/${projectCode}/dashboard`,
    ],
  });

  if (result.ok && !id) redirect(`/${projectCode}/comercial/seguimientos`);
  return result;
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

// =====================================================================
// Actividad comercial
// =====================================================================
export async function saveActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const clientId = String(formData.get('client_id') ?? '');

  return persistRecord({
    projectCode,
    table: 'commercial_activities',
    module: 'opportunities',
    id,
    schema: ActivitySchema,
    raw: formToObject(formData),
    stamp: {},
    extra: { user_id: (await requireProject(projectCode)).session.user?.id ?? null },
    revalidate: [`/${projectCode}/comercial/clientes/${clientId}`],
    successMessage: 'Actividad registrada.',
  });
}
