import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getOpportunityOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { FollowUpForm, type FollowUpRecord } from '@/components/commercial/follow-up-form';

export const metadata: Metadata = { title: 'Seguimiento' };

export default async function FollowUpFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/comercial/seguimientos`;

  const [record, clients, opportunities] = await Promise.all([
    loadRecord<FollowUpRecord>('follow_ups', id, project.id),
    getClientOptions(project.id),
    getOpportunityOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="follow_ups" isEdit={Boolean(id)}
      entityLabel="seguimiento" backHref={back} backLabel="Seguimientos" width="max-w-2xl">
      <FollowUpForm projectCode={project.code} record={record} cancelHref={back}
        clients={clients} opportunities={opportunities} />
    </FormPage>
  );
}
