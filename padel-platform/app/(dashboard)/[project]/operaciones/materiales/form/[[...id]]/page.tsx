import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getManufacturingOptions, getMaterialOptions, getSaleOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import {
  MaterialRequirementForm, type MaterialRequirementRecord,
} from '@/components/operations/material-requirement-form';

export const metadata: Metadata = { title: 'Requerimiento de material' };

export default async function MaterialFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/operaciones/materiales`;

  const [record, materials, manufacturing, sales] = await Promise.all([
    loadRecord<MaterialRequirementRecord>('material_requirements', id, project.id),
    getMaterialOptions(project.id),
    getManufacturingOptions(project.id),
    getSaleOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="materials" isEdit={Boolean(id)}
      entityLabel="requerimiento" backHref={back} backLabel="Materiales" width="max-w-2xl">
      <MaterialRequirementForm projectCode={project.code} record={record} cancelHref={back}
        materials={materials} manufacturing={manufacturing} sales={sales} />
    </FormPage>
  );
}
