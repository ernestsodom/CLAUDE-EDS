'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { PasswordSchema, UserSchema } from '@/lib/validations/users';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';
import type { SessionContext, SessionProject } from '@/types/database.types';

/**
 * Administracion de usuarios (§96).
 *
 * Crear/editar usuarios y contrasenas exige tocar `auth.users`, algo que
 * RLS no puede proteger (esa tabla no la expone PostgREST). Por eso estas
 * acciones usan `createAdminClient()` (service_role) y son las UNICAS del
 * codigo que lo hacen para escritura de usuarios: el permiso real se
 * evalua a mano aqui, con `settings.manage`, antes de tocar nada.
 *
 * `profiles` tiene ademas su propio candado: solo el dueno puede editar su
 * fila via API normal (022_rls.sql), asi que un admin de proyecto SOLO
 * puede tocar el perfil de otro usuario a traves de esta accion.
 */

type FormState = ActionResult<{ id: string }> | null;

function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

async function assertUserAdmin(
  projectCode: string,
): Promise<{ project: SessionProject; session: SessionContext }> {
  const { project, session } = await requireProject(projectCode);
  if (!can(project, 'settings.manage')) {
    throw new Error('No tienes permiso para administrar usuarios de este proyecto.');
  }
  return { project, session };
}

export async function saveUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  let project: SessionProject;
  let session: SessionContext;
  try {
    ({ project, session } = await assertUserAdmin(projectCode));
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'No autorizado.');
  }

  const parsed = UserSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    phone: (formData.get('phone') as string | null)?.trim() || undefined,
    job_title: (formData.get('job_title') as string | null)?.trim() || undefined,
    role_id: formData.get('role_id'),
    active: formData.get('active') === 'true',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(issue?.message ?? 'Datos invalidos.');
  }
  const data = parsed.data;
  const admin = createAdminClient();

  if (id) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        job_title: data.job_title ?? null,
        active: data.active,
      })
      .eq('id', id);
    if (profileError) return failure(toUserMessage(profileError.message));

    // Mantiene el email de auth.users sincronizado con el del perfil.
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email: data.email,
      user_metadata: { full_name: data.full_name },
    });
    if (authError) return failure(toUserMessage(authError.message));

    const { error: upaError } = await admin
      .from('user_project_access')
      .upsert(
        {
          user_id: id,
          project_id: project.id,
          role_id: data.role_id,
          active: data.active,
          granted_by: session.user?.id ?? null,
        },
        { onConflict: 'user_id,project_id' },
      );
    if (upaError) return failure(toUserMessage(upaError.message));

    revalidatePath(`/${projectCode}/configuracion/usuarios`);
    return success({ id }, 'Usuario actualizado.');
  }

  const passwordCheck = PasswordSchema.safeParse({ password: formData.get('password') });
  if (!passwordCheck.success) {
    return failure(passwordCheck.error.issues[0]?.message ?? 'Contrasena invalida.');
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: passwordCheck.data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name },
  });
  if (createError) return failure(toUserMessage(createError.message));

  const newUserId = created.user?.id;
  if (!newUserId) return failure('No se pudo crear el usuario.');

  // app.handle_new_user ya inserto la fila en profiles al crear el auth
  // user; aqui completamos los campos que el trigger no conoce.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: data.full_name,
      phone: data.phone ?? null,
      job_title: data.job_title ?? null,
      active: data.active,
    })
    .eq('id', newUserId);
  if (profileError) return failure(toUserMessage(profileError.message));

  const { error: upaError } = await admin.from('user_project_access').insert({
    user_id: newUserId,
    project_id: project.id,
    role_id: data.role_id,
    active: data.active,
    granted_by: session.user?.id ?? null,
  });
  if (upaError) return failure(toUserMessage(upaError.message));

  revalidatePath(`/${projectCode}/configuracion/usuarios`);
  return success({ id: newUserId }, 'Usuario creado.');
}

/** Cambia la contrasena de un usuario. Solo un admin de proyecto puede invocarlo. */
export async function resetUserPassword(
  projectCode: string,
  userId: string,
  password: string,
): Promise<ActionResult<null>> {
  try {
    await assertUserAdmin(projectCode);
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'No autorizado.');
  }

  const parsed = PasswordSchema.safeParse({ password });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Contrasena invalida.');
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
  });
  if (error) return failure(toUserMessage(error.message));

  return success(null, 'Contrasena actualizada.');
}

/** Revoca o restaura el acceso de un usuario a este proyecto (no borra la cuenta). */
export async function setUserAccessActive(
  projectCode: string,
  userId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  let project: SessionProject;
  try {
    ({ project } = await assertUserAdmin(projectCode));
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'No autorizado.');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_project_access')
    .update({ active, revoked_at: active ? null : new Date().toISOString() })
    .eq('user_id', userId)
    .eq('project_id', project.id);
  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/configuracion/usuarios`);
  return success(null, active ? 'Acceso restaurado.' : 'Acceso revocado.');
}
