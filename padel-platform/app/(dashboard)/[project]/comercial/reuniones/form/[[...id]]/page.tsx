import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getOpportunityOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { MeetingForm, type MeetingRecord } from '@/components/commercial/meeting-form';

export const metadata: Metadata = { title: 'Reunion' };

export default async function MeetingFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/comercial/reuniones`;

  const [record, clients, opportunities] = await Promise.all([
    loadRecord<MeetingRecord>('meetings', id, project.id),
    getClientOptions(project.id),
    getOpportunityOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="meetings" isEdit={Boolean(id)}
      entityLabel="reunion" backHref={back} backLabel="Reuniones">
      <MeetingForm projectCode={project.code} record={record} cancelHref={back}
        clients={clients} opportunities={opportunities} />
    </FormPage>
  );
}
