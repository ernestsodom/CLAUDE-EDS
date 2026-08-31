import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { DealForm } from '@/components/deals/deal-form';
import type { Deal } from '@/types/database.types';

export const metadata: Metadata = { title: 'Negocio' };

export default async function DealFormPage({
  params,
}: {
  params: Promise<{ project: string; id?: string[] }>;
}) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id ? `/${project.code}/negocios/${id}` : `/${project.code}/negocios`;

  const record = await loadRecord<Deal>('deals', id, project.id);
  if (id && !record) notFound();

  return (
    <FormPage
      project={project}
      module="deals"
      isEdit={Boolean(id)}
      entityLabel="negocio"
      backHref={back}
      backLabel={id ? 'Ficha del negocio' : 'Negocios'}
      subtitle={record?.client_name}
    >
      <DealForm projectCode={project.code} record={record} cancelHref={back} />
    </FormPage>
  );
}
