import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { ClientForm, type ClientRecord } from '@/components/commercial/client-form';

export const metadata: Metadata = { title: 'Cliente' };

export default async function ClientFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = id
    ? `/${project.code}/comercial/clientes/${id}`
    : `/${project.code}/comercial/clientes`;

  const record = await loadRecord<ClientRecord>('clients', id, project.id);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="clients" isEdit={Boolean(id)}
      entityLabel="cliente" backHref={back} backLabel={id ? 'Ficha de cliente' : 'Clientes'}
      subtitle={record?.company_name}>
      <ClientForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} />
    </FormPage>
  );
}
