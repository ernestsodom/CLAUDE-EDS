import 'server-only';

import { createClient } from '@/lib/supabase/server';

export interface Option {
  value: string;
  label: string;
}

/**
 * Opciones de los desplegables de formulario.
 *
 * Se cargan en el servidor con RLS aplicado: un usuario solo puede
 * seleccionar entidades de su propio proyecto, asi que es imposible
 * construir una relacion que cruce unidades de negocio desde la UI.
 *
 * El limite de 500 es deliberado: por encima de eso un `<select>` deja de
 * ser usable y toca un buscador, no una lista mas larga.
 */
const LIMIT = 500;

export async function getClientOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('company_name')
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: r.company_name }));
}

export async function getContactOptions(clientId: string | null): Promise<Option[]> {
  if (!clientId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('first_name');
  return (data ?? []).map((r) => ({
    value: r.id,
    label: [r.first_name, r.last_name].filter(Boolean).join(' '),
  }));
}

export async function getSupplierOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('suppliers')
    .select('id, company_name')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('company_name')
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: r.company_name }));
}

export async function getSaleOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales')
    .select('id, sale_number, clients(company_name)')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('sale_date', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => {
    const client = (r as unknown as { clients: { company_name: string } | null }).clients;
    return {
      value: r.id,
      label: client ? `${r.sale_number} · ${client.company_name}` : r.sale_number,
    };
  });
}

export async function getOpportunityOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('opportunities')
    .select('id, name')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: r.name }));
}

export async function getCostCategoryOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cost_categories')
    .select('id, name, cost_group, project_id')
    .or(`project_id.is.null,project_id.eq.${projectId}`)
    .eq('active', true)
    .order('sort_order');
  return (data ?? []).map((r) => ({ value: r.id, label: `${r.cost_group} · ${r.name}` }));
}

export async function getMaterialOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('materials')
    .select('id, code, name, unit')
    .or(`project_id.is.null,project_id.eq.${projectId}`)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name')
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.unit})` }));
}

export async function getManufacturingOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('manufacturing_projects')
    .select('id, name')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: r.name }));
}

export async function getCourtOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('courts')
    .select('id, court_number, model')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('court_number')
    .limit(LIMIT);
  return (data ?? []).map((r) => ({
    value: r.id,
    label: r.model ? `${r.court_number} · ${r.model}` : r.court_number,
  }));
}

export async function getBankAccountOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bank_accounts')
    .select('id, name, currency')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .eq('active', true)
    .order('name');
  return (data ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.currency})` }));
}

export async function getInvoiceOptions(
  projectId: string,
  kind: 'VENTA' | 'COMPRA',
): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, balance')
    .eq('project_id', projectId)
    .eq('kind', kind)
    .is('deleted_at', null)
    .not('status', 'in', '("ANULADA")')
    .order('invoice_date', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => ({
    value: r.id,
    label: `${r.invoice_number} · saldo ${r.balance}`,
  }));
}

export async function getShipmentOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('shipments')
    .select('id, shipment_number')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('departure_date', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => ({ value: r.id, label: r.shipment_number }));
}

export async function getInstallationOptions(projectId: string): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('installations')
    .select('id, installation_number, name')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('planned_start_date', { ascending: false })
    .limit(LIMIT);
  return (data ?? []).map((r) => ({
    value: r.id,
    label: r.name ? `${r.installation_number} · ${r.name}` : r.installation_number,
  }));
}

/** Roles del sistema (globales, no por proyecto). */
export async function getRoleOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('roles').select('id, name').order('level', { ascending: false });
  return (data ?? []).map((r) => ({ value: r.id, label: r.name }));
}

/** Carga un registro para editarlo, o null si es un alta. */
export async function loadRecord<T>(
  table: string,
  id: string | undefined,
  projectId: string,
  select = '*',
): Promise<T | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select(select)
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle();
  return (data as T) ?? null;
}
