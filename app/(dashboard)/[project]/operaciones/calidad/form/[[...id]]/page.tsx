import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getCourtOptions, getInstallationOptions, getManufacturingOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { QualityForm, type QualityRecord } from '@/components/operations/quality-form';

export const metadata: Metadata = { title: 'Control de calidad' };

export default async function QualityFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/operaciones/calidad`;

  const [record, courts, manufacturing, installations] = await Promise.all([
    loadRecord<QualityRecord>('quality_checks', id, project.id),
    getCourtOptions(project.id),
    getManufacturingOptions(project.id),
    getInstallationOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="quality" isEdit={Boolean(id)}
      entityLabel="control de calidad" backHref={back} backLabel="Calidad" width="max-w-2xl">
      <QualityForm projectCode={project.code} record={record} cancelHref={back}
        courts={courts} manufacturing={manufacturing} installations={installations} />
    </FormPage>
  );
}
