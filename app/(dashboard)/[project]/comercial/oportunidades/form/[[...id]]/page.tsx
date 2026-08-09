import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { OpportunityForm, type OpportunityRecord } from '@/components/commercial/opportunity-form';

export const metadata: Metadata = { title: 'Oportunidad' };

export default async function OpportunityFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/comercial/oportunidades`;

  const [record, clients] = await Promise.all([
    loadRecord<OpportunityRecord>('opportunities', id, project.id),
    getClientOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="opportunities" isEdit={Boolean(id)}
      entityLabel="oportunidad" backHref={back} backLabel="Oportunidades"
      subtitle={record?.name}>
      <OpportunityForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} />
    </FormPage>
  );
}
