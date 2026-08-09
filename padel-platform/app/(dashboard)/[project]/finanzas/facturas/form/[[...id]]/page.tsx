import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getClientOptions, getSaleOptions, getSupplierOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { InvoiceForm, type InvoiceRecord } from '@/components/finance/invoice-form';

export const metadata: Metadata = { title: 'Factura' };

export default async function InvoiceFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/finanzas/facturas`;

  const supabase = await createClient();
  const [record, clients, suppliers, sales, poRes] = await Promise.all([
    loadRecord<InvoiceRecord>('invoices', id, project.id),
    getClientOptions(project.id),
    getSupplierOptions(project.id),
    getSaleOptions(project.id),
    supabase.from('purchase_orders').select('id, po_number')
      .eq('project_id', project.id).is('deleted_at', null)
      .order('order_date', { ascending: false }).limit(200),
  ]);
  if (id && !record) notFound();

  const purchaseOrders = (poRes.data ?? []).map((r) => ({ value: r.id, label: r.po_number }));

  return (
    <FormPage project={project} module="invoices" isEdit={Boolean(id)}
      entityLabel="factura" backHref={back} backLabel="Facturas"
      subtitle={record?.invoice_number}>
      <InvoiceForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} suppliers={suppliers}
        sales={sales} purchaseOrders={purchaseOrders} />
    </FormPage>
  );
}
