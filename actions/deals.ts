'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import {
  CourtModelSchema, DealCourtSchema, DealSchema, LogoPositionSchema, isClosedStatus,
} from '@/lib/validations/deals';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

/**
 * Modulo Negocios (trader).
 *
 * Aqui vive una sola regla que no se puede relajar: si la venta no esta
 * cerrada, el negocio no guarda fecha de cierre ni de entrega. No basta
 * con ocultar los campos en el formulario —el usuario puede cambiar el
 * estado despues de haberlos rellenado—, asi que se anulan de forma
 * explicita antes de escribir. La base lo vuelve a comprobar con
 * `deals_dates_ck`: dos capas, ninguna sustituye a la otra.
 */

type FormState = ActionResult<{ id: string }> | null;

function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

// =====================================================================
// Negocios
// =====================================================================
export async function saveDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const raw = formToObject(formData, { numbers: ['commission_per_court_usd'] });
  const status = String(raw.status ?? 'POTENCIAL');

  // Un campo que el formulario no envia (porque esta oculto) se queda
  // `undefined` y no se escribiria: hay que anularlo a proposito para que
  // la columna quede realmente vacia al reabrir un negocio.
  const closed = isClosedStatus(status);
  const extra: Record<string, unknown> = closed
    ? { closed_at: raw.closed_at ?? null, delivery_date: raw.delivery_date ?? null }
    : { closed_at: null, delivery_date: null };

  if (status !== 'PERDIDA') extra.lost_reason = null;

  const result = await persistRecord({
    projectCode,
    table: 'deals',
    module: 'deals',
    id,
    schema: DealSchema,
    raw,
    extra,
    revalidate: [`/${projectCode}/negocios`],
    successMessage: id ? 'Negocio actualizado.' : 'Negocio creado.',
  });

  if (result.ok && !id) redirect(`/${projectCode}/negocios/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/negocios/${id}`);
  return result;
}

export async function deleteDeal(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'deals', id, module: 'deals',
    revalidate: [`/${projectCode}/negocios`],
  });
}

// =====================================================================
// Canchas del negocio
// =====================================================================
export async function saveDealCourt(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const dealId = String(formData.get('deal_id') ?? '');

  const result = await persistRecord({
    projectCode,
    table: 'deal_courts',
    module: 'deals',
    id,
    schema: DealCourtSchema,
    raw: formToObject(formData, {
      booleans: ['is_custom'],
      numbers: ['position', 'commission_usd'],
    }),
    stamp: {},
    revalidate: [`/${projectCode}/negocios`, `/${projectCode}/negocios/${dealId}`],
    successMessage: id ? 'Cancha actualizada.' : 'Cancha anadida.',
  });

  return result;
}

export async function deleteDealCourt(
  projectCode: string,
  courtId: string,
  dealId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'deals.delete')) {
    return failure('No tienes permiso para eliminar canchas de este negocio.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('deal_courts')
    .delete()
    .eq('id', courtId)
    .eq('project_id', project.id);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/negocios/${dealId}`);
  revalidatePath(`/${projectCode}/negocios`);
  return success(null, 'Cancha eliminada.');
}

/**
 * Marca o desmarca "el logo <marca> va en <posicion>" para una cancha.
 *
 * Es un toggle y no un formulario completo porque asi funciona la
 * pantalla: una rejilla de casillas marca x posicion.
 */
export async function toggleCourtLogo(options: {
  projectCode: string;
  dealId: string;
  courtId: string;
  brand: 'ATILA' | 'CLUB';
  logoPositionId: string;
  enabled: boolean;
}): Promise<ActionResult<null>> {
  const { projectCode, dealId, courtId, brand, logoPositionId, enabled } = options;

  const { project } = await requireProject(projectCode);
  if (!can(project, 'deals.update')) {
    return failure('No tienes permiso para modificar este negocio.');
  }

  const supabase = await createClient();

  if (enabled) {
    const { error } = await supabase.from('deal_court_logos').insert({
      project_id: project.id,
      deal_court_id: courtId,
      brand,
      logo_position_id: logoPositionId,
    });
    if (error) return failure(toUserMessage(error.message));
  } else {
    const { error } = await supabase
      .from('deal_court_logos')
      .delete()
      .eq('deal_court_id', courtId)
      .eq('brand', brand)
      .eq('logo_position_id', logoPositionId)
      .eq('project_id', project.id);
    if (error) return failure(toUserMessage(error.message));
  }

  revalidatePath(`/${projectCode}/negocios/${dealId}`);
  return success(null, enabled ? 'Logo anadido.' : 'Logo quitado.');
}

// =====================================================================
// Catalogos editables (tipos de cancha y posiciones de logo)
//
// Los gestiona quien administra el proyecto: `settings.manage`, igual que
// la policy de la tabla.
// =====================================================================
export async function saveCourtModel(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveCatalogItem(formData, 'court_models', CourtModelSchema);
}

export async function saveLogoPosition(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveCatalogItem(formData, 'logo_positions', LogoPositionSchema);
}

async function saveCatalogItem(
  formData: FormData,
  table: 'court_models' | 'logo_positions',
  schema: typeof CourtModelSchema | typeof LogoPositionSchema,
): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const { project } = await requireProject(projectCode);
  if (!can(project, 'settings.manage')) {
    return failure('Solo un administrador puede editar los catalogos del proyecto.');
  }

  const parsed = schema.safeParse(
    formToObject(formData, {
      booleans: ['active'],
      numbers: ['sort_order', 'default_commission_usd'],
    }),
  );

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(issue?.message ?? 'Datos invalidos.');
  }

  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from(table)
      .update(parsed.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select('id')
      .maybeSingle();

    if (error) return failure(toUserMessage(error.message));
    if (!data) return failure('No se pudo actualizar: el registro no existe o no tienes acceso.');

    revalidatePath(`/${projectCode}/configuracion/catalogos`);
    return success({ id: data.id }, 'Catalogo actualizado.');
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...parsed.data, project_id: project.id })
    .select('id')
    .single();

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/configuracion/catalogos`);
  return success({ id: data.id }, 'Anadido al catalogo.');
}

/**
 * Activa o desactiva una entrada del catalogo.
 *
 * No se borra: un tipo de cancha puede estar referenciado por negocios
 * historicos y perderlo falsearia el historial (§83).
 */
export async function setCatalogItemActive(
  projectCode: string,
  table: 'court_models' | 'logo_positions',
  id: string,
  active: boolean,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'settings.manage')) {
    return failure('Solo un administrador puede editar los catalogos del proyecto.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ active })
    .eq('id', id)
    .eq('project_id', project.id);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/configuracion/catalogos`);
  return success(null, active ? 'Reactivado.' : 'Desactivado.');
}
