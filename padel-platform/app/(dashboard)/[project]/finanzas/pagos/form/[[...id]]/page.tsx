import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/auth/session';
import {
  getBankAccountOptions, getClientOptions, getInvoiceOptions, getSaleOptions,
  getSupplierOptions, loadRecord,
} from '@/lib/services/options';
import { FormPage } from '@/components/forms/form-page';
import { PaymentForm, type PaymentRecord } from '@/components/finance/payment-form';

export const metadata: Metadata = { title: 'Pago' };

export default async function PaymentFormPage({
  params,
}: { params: Promise<{ project: string; id?: string[] }> }) {
  const { project: projectCode, id: idParts } = await params;
  const id = idParts?.[0];
  const { project } = await requireProject(projectCode);
  const back = `/${project.code}/finanzas/pagos`;

  const [record, clients, suppliers, banks, salesInvoices, purchaseInvoices, sales] =
    await Promise.all([
      loadRecord<PaymentRecord>('payments', id, project.id),
      getClientOptions(project.id),
      getSupplierOptions(project.id),
      getBankAccountOptions(project.id),
      getInvoiceOptions(project.id, 'VENTA'),
      getInvoiceOptions(project.id, 'COMPRA'),
      getSaleOptions(project.id),
    ]);
  if (id && !record) notFound();

  return (
    <FormPage project={project} module="payments" isEdit={Boolean(id)}
      entityLabel="pago" backHref={back} backLabel="Pagos">
      <PaymentForm projectCode={project.code} record={record} cancelHref={back}
        currency={project.default_currency} clients={clients} suppliers={suppliers}
        banks={banks} salesInvoices={salesInvoices} purchaseInvoices={purchaseInvoices}
        sales={sales} />
    </FormPage>
  );
}
