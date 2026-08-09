import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { SupplierForm, type SupplierRecord } from '@/components/operations/supplier-form';

export const metadata: Metadata = { title: 'Proveedor' };

export default async function SupplierFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/operaciones/proveedores`;

  const record = await loadRecord<SupplierRecord>('suppliers', id, project.id);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="suppliers" isEdit={Boolean(id)}
      entityLabel="proveedor" backHref={back} backLabel="Proveedores"
      subtitle={record ? record.company_name : undefined}>
      <SupplierForm projectCode={project.code} record={record} cancelHref={back} />
    </FormPage>
  );
}
