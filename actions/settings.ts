'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

/**
 * Configuracion del proyecto.
 *
 * Encender o apagar un modulo es un cambio de datos, no de codigo (§2):
 * el menu se reconstruye en el siguiente render. Es lo que permite que
 * ATILA trabaje solo con Negocios mientras EUROPA conserva toda la
 * operacion industrial, sin dos aplicaciones distintas.
 */
export async function setProjectModule(
  projectCode: string,
  moduleCode: string,
  enabled: boolean,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'settings.manage')) {
    return failure('Solo un administrador puede cambiar los modulos del proyecto.');
  }

  // `settings` no se puede apagar: dejaria el proyecto sin la pantalla
  // desde la que volver a encender nada.
  if (moduleCode === 'settings' && !enabled) {
    return failure('Configuracion no se puede desactivar: es la via para volver a activar el resto.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('project_modules')
    .upsert(
      { project_id: project.id, module_code: moduleCode, enabled },
      { onConflict: 'project_id,module_code' },
    );

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}`, 'layout');
  return success(null, enabled ? 'Modulo activado.' : 'Modulo desactivado.');
}
