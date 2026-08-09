import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getSaleOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { ManufacturingForm, type ManufacturingRecord } from '@/components/operations/manufacturing-form';

export const metadata: Metadata = { title: 'Fabricacion' };

export default async function ManufacturingFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/operaciones/fabricacion/${id}`
    : `/${project.code}/operaciones/fabricacion`;

  const [record, clients, sales] = await Promise.all([
    loadRecord<ManufacturingRecord>('manufacturing_projects', id, project.id),
    getClientOptions(project.id),
    getSaleOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="manufacturing" isEdit={Boolean(id)}
      entityLabel="proyecto de fabricacion" backHref={back}
      backLabel={id ? 'Proyecto' : 'Fabricacion'} subtitle={record?.name}>
      <ManufacturingForm projectCode={project.code} record={record} cancelHref={back}
        clients={clients} sales={sales} />
    </FormPage>
  );
}
