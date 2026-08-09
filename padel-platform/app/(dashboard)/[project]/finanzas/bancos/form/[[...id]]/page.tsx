import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import { loadRecord } from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { BankAccountForm, type BankAccountRecord } from '@/components/finance/bank-account-form';

export const metadata: Metadata = { title: 'Cuenta bancaria' };

export default async function BankAccountFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/finanzas/bancos`;

  const record = await loadRecord<BankAccountRecord>('bank_accounts', id, project.id);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="banks" isEdit={Boolean(id)}
      entityLabel="cuenta bancaria" backHref={back} backLabel="Bancos" width="max-w-2xl">
      <BankAccountForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} />
    </FormPage>
  );
}
