import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getClientOptions, getSaleOptions, getShipmentOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { InstallationForm, type InstallationRecord } from '@/components/operations/installation-form';

export const metadata: Metadata = { title: 'Instalacion' };

export default async function InstallationFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/operaciones/instalaciones/${id}`
    : `/${project.code}/operaciones/instalaciones`;

  const [record, clients, sales, shipments] = await Promise.all([
    loadRecord<InstallationRecord>('installations', id, project.id),
    getClientOptions(project.id),
    getSaleOptions(project.id),
    getShipmentOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="installations" isEdit={Boolean(id)}
      entityLabel="instalacion" backHref={back}
      backLabel={id ? 'Instalacion' : 'Instalaciones'} subtitle={record?.installation_number}>
      <InstallationForm projectCode={project.code} record={record} cancelHref={back}
        clients={clients} sales={sales} shipments={shipments} />
    </FormPage>
  );
}
