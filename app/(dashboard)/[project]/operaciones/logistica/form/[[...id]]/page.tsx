import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getSaleOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { ShipmentForm, type ShipmentRecord } from '@/components/operations/shipment-form';

export const metadata: Metadata = { title: 'Embarque' };

export default async function ShipmentFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/operaciones/logistica/${id}`
    : `/${project.code}/operaciones/logistica`;

  const [record, clients, sales] = await Promise.all([
    loadRecord<ShipmentRecord>('shipments', id, project.id),
    getClientOptions(project.id),
    getSaleOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="logistics" isEdit={Boolean(id)}
      entityLabel="embarque" backHref={back} backLabel={id ? 'Embarque' : 'Logistica'}
      subtitle={record?.shipment_number}>
      <ShipmentForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} sales={sales} />
    </FormPage>
  );
}
