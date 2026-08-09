import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getBankAccountOptions, getCostCategoryOptions, getSaleOptions, getSupplierOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { ExpenseForm, type ExpenseRecord } from '@/components/finance/expense-form';

export const metadata: Metadata = { title: 'Gasto' };

export default async function ExpenseFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/finanzas/gastos`;

  const [record, categories, sales, suppliers, banks] = await Promise.all([
    loadRecord<ExpenseRecord>('expenses', id, project.id),
    getCostCategoryOptions(project.id),
    getSaleOptions(project.id),
    getSupplierOptions(project.id),
    getBankAccountOptions(project.id),
  ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="expenses" isEdit={Boolean(id)}
      entityLabel="gasto" backHref={back} backLabel="Gastos">
      <ExpenseForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} categories={categories} sales={sales}
        suppliers={suppliers} banks={banks} />
    </FormPage>
  );
}
