import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getOpportunityOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { SaleForm, type SaleRecord } from '@/components/commercial/sale-form';

export const metadata: Metadata = { title: 'Venta' };

export default async function SaleFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id ? `/${project.code}/ventas/${id}` : `/${project.code}/ventas`;

  const [record, clients, opportunities] = await Promise.all([
    loadRecord<SaleRecord>('sales', id, project.id),
    getClientOptions(project.id),
    getOpportunityOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="sales" isEdit={Boolean(id)}
      entityLabel="venta" backHref={back} backLabel={id ? 'Ficha de venta' : 'Ventas'}
      subtitle={record?.sale_number}>
      <SaleForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} opportunities={opportunities} />
    </FormPage>
  );
}
