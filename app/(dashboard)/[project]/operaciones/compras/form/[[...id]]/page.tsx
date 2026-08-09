import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getManufacturingOptions, getSaleOptions, getSupplierOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import {
  PurchaseOrderForm, type PurchaseOrderRecord,
} from '@/components/operations/purchase-order-form';

export const metadata: Metadata = { title: 'Orden de compra' };

export default async function PurchaseOrderFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/operaciones/compras/${id}`
    : `/${project.code}/operaciones/compras`;

  const [record, suppliers, manufacturing, sales] = await Promise.all([
    loadRecord<PurchaseOrderRecord>('purchase_orders', id, project.id),
    getSupplierOptions(project.id),
    getManufacturingOptions(project.id),
    getSaleOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="purchases" isEdit={Boolean(id)}
      entityLabel="orden de compra" backHref={back} backLabel={id ? 'Orden' : 'Ordenes de compra'}
      subtitle={record?.po_number}>
      <PurchaseOrderForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} suppliers={suppliers}
        manufacturing={manufacturing} sales={sales} />
    </FormPage>
  );
}
