import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getClientOptions, getManufacturingOptions, getSaleOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { CourtForm, type CourtRecord } from '@/components/operations/court-form';

export const metadata: Metadata = { title: 'Cancha' };

export default async function CourtFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/operaciones/canchas/${id}`
    : `/${project.code}/operaciones/canchas`;

  const [record, clients, sales, manufacturing] = await Promise.all([
    loadRecord<CourtRecord>('courts', id, project.id),
    getClientOptions(project.id),
    getSaleOptions(project.id),
    getManufacturingOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="courts" isEdit={Boolean(id)}
      entityLabel="cancha" backHref={back} backLabel={id ? 'Ficha de cancha' : 'Canchas'}
      subtitle={record?.court_number}>
      <CourtForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} defaultType={project.court_kind}
        clients={clients} sales={sales} manufacturing={manufacturing} />
    </FormPage>
  );
}
