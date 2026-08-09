import 'server-only';

import { revalidatePath } from 'next/cache';
import type { ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

/**
 * Motor comun de alta y edicion.
 *
 * Cada formulario aporta su esquema Zod y su mapa de campos; el resto
 * (permisos, insercion vs actualizacion, `project_id`, autoria,
 * traduccion de errores y revalidacion) es identico y vive aqui. Asi una
 * regla nueva —por ejemplo registrar quien edito— se aplica de una vez a
 * las veinte pantallas en lugar de veinte veces.
 *
 * La comprobacion de permiso da un mensaje util; la autorizacion real
 * sigue siendo RLS en PostgreSQL.
 */
export async function persistRecord<T extends Record<string, unknown>>(options: {
  projectCode: string;
  table: string;
  schema: ZodType<T>;
  raw: unknown;
  /** id presente => UPDATE; ausente => INSERT */
  id?: string | null;
  module: string;
  /** Campos de autoria que la tabla admite. */
  stamp?: { createdBy?: boolean; uploadedBy?: boolean };
  /** Valores fijos que no vienen del formulario. */
  extra?: Record<string, unknown>;
  revalidate?: string[];
  successMessage?: string;
}): Promise<ActionResult<{ id: string }>> {
  const {
    projectCode, table, schema, raw, id, module,
    stamp = { createdBy: true }, extra = {}, revalidate = [], successMessage,
  } = options;

  const isUpdate = Boolean(id);
  const permission = `${module}.${isUpdate ? 'update' : 'create'}`;

  const { project, session } = await requireProject(projectCode);
  if (!can(project, permission)) {
    return failure(
      isUpdate
        ? 'No tienes permiso para modificar este registro.'
        : 'No tienes permiso para crear este registro.',
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join('.') ?? '';
    return failure(field ? `${issue.message} (${field})` : (issue?.message ?? 'Datos invalidos'));
  }

  const supabase = await createClient();
  const values: Record<string, unknown> = { ...parsed.data, ...extra };

  if (isUpdate) {
    const { data, error } = await supabase
      .from(table)
      .update(values)
      .eq('id', id!)
      .eq('project_id', project.id)
      .select('id')
      .maybeSingle();

    if (error) return failure(toUserMessage(error.message));
    if (!data) {
      // RLS filtro la fila: existe pero el usuario no puede tocarla.
      return failure('No se pudo actualizar: el registro no existe o no tienes acceso.');
    }

    revalidate.forEach((path) => revalidatePath(path));
    return success({ id: data.id }, successMessage ?? 'Cambios guardados.');
  }

  values.project_id = project.id;
  if (stamp.createdBy) values.created_by = session.user?.id ?? null;
  if (stamp.uploadedBy) values.uploaded_by = session.user?.id ?? null;

  const { data, error } = await supabase.from(table).insert(values).select('id').single();

  if (error) return failure(toUserMessage(error.message));

  revalidate.forEach((path) => revalidatePath(path));
  return success({ id: data.id }, successMessage ?? 'Registro creado.');
}

/**
 * Borrado logico (§83).
 *
 * Nunca se elimina fisicamente informacion financiera o historica: se
 * marca `deleted_at`. Las tablas sin esa columna no admiten esta accion.
 */
export async function softDeleteRecord(options: {
  projectCode: string;
  table: string;
  id: string;
  module: string;
  revalidate?: string[];
}): Promise<ActionResult<null>> {
  const { projectCode, table, id, module, revalidate = [] } = options;

  const { project } = await requireProject(projectCode);
  if (!can(project, `${module}.delete`)) {
    return failure('No tienes permiso para eliminar este registro.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', project.id)
    .select('id')
    .maybeSingle();

  if (error) return failure(toUserMessage(error.message));
  if (!data) return failure('No se pudo eliminar: el registro no existe o no tienes acceso.');

  revalidate.forEach((path) => revalidatePath(path));
  return success(null, 'Registro eliminado.');
}

/**
 * FormData -> objeto plano.
 *
 * Las cadenas vacias se convierten en `undefined` para que Zod aplique
 * sus valores por defecto y para no escribir '' donde la base espera NULL.
 * Las casillas no marcadas no llegan en FormData, de ahi `booleans`.
 */
export function formToObject(
  formData: FormData,
  options: { booleans?: string[]; numbers?: string[] } = {},
): Record<string, unknown> {
  const { booleans = [], numbers = [] } = options;
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    result[key] = trimmed === '' ? undefined : trimmed;
  }

  for (const key of booleans) {
    result[key] = formData.get(key) === 'true';
  }
  for (const key of numbers) {
    const raw = result[key];
    result[key] = raw === undefined ? undefined : Number(raw);
  }

  return result;
}
