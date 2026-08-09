import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { getClientOptions, getSaleOptions, loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { ContractForm, type ContractRecord } from '@/components/finance/contract-form';

export const metadata: Metadata = { title: 'Contrato' };

export default async function ContractFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/finanzas/contratos`;

  const [record, clients, sales] = await Promise.all([
    loadRecord<ContractRecord>('contracts', id, project.id),
    getClientOptions(project.id),
    getSaleOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="contracts" isEdit={Boolean(id)}
      entityLabel="contrato" backHref={back} backLabel="Contratos"
      subtitle={record?.contract_number}>
      <ContractForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} sales={sales} />
    </FormPage>
  );
}
