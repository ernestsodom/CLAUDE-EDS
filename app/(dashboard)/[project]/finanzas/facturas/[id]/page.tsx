import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { Card, DataPoint, Field, PageHeader, ProgressBar, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceLines, type InvoiceLine } from '@/components/finance/invoice-lines';
import type { CurrencyCode } from '@/types/database.types';

export const metadata: Metadata = { title: 'Factura' };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data } = await supabase
    .from('invoices')
    .select('*, clients(company_name), suppliers(company_name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) notFound();

  const invoice = data as unknown as {
    id: string; kind: string; invoice_number: string; external_number: string | null;
    invoice_date: string; due_date: string | null; status: string; currency: CurrencyCode;
    subtotal: number; tax_rate: number; tax: number; total: number;
    paid_amount: number; balance: number; sale_id: string | null; notes: string | null;
    clients: { company_name: string } | null;
    suppliers: { company_name: string } | null;
  };

  const [itemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('invoice_items')
      .select('id, description, quantity, unit_price, discount, subtotal')
      .eq('invoice_id', id)
      .order('created_at'),
    supabase
      .from('payments')
      .select('id, payment_date, amount, currency, method, reference')
      .eq('invoice_id', id)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false }),
  ]);

  const lines = (itemsRes.data ?? []) as InvoiceLine[];
  const payments = (paymentsRes.data ?? []) as {
    id: string; payment_date: string; amount: number; currency: CurrencyCode;
    method: string; reference: string | null;
  }[];

  const editable = can(project, 'invoices.update');
  const isSale = invoice.kind === 'VENTA';
  const party = isSale ? invoice.clients?.company_name : invoice.suppliers?.company_name;
  const overdue =
    invoice.due_date &&
    invoice.due_date < new Date().toISOString().slice(0, 10) &&
    Number(invoice.balance) > 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/finanzas/facturas`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Facturas
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {invoice.invoice_number}
            <StatusBadge status={invoice.status} />
          </span>
        }
        subtitle={`${isSale ? 'Factura de venta' : 'Factura de compra'} · ${party ?? '—'}`}
        actions={
          <div className="flex gap-2">
            {editable ? (
              <Link href={`${base}/finanzas/facturas/form/${invoice.id}`} className="btn-secondary">
                <Pencil size={14} /> Editar
              </Link>
            ) : null}
            {can(project, 'payments.create') && Number(invoice.balance) > 0 ? (
              <Link href={`${base}/finanzas/pagos/form`} className="btn-primary">
                <Plus size={14} /> Registrar pago
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <DataPoint label="Total" value={formatMoney(invoice.total, invoice.currency)} />
        </Card>
        <Card>
          <DataPoint label="Cobrado" value={formatMoney(invoice.paid_amount, invoice.currency)} tone="success" />
        </Card>
        <Card>
          <DataPoint
            label="Saldo"
            value={formatMoney(invoice.balance, invoice.currency)}
            tone={overdue ? 'critical' : Number(invoice.balance) > 0 ? 'warning' : 'success'}
            hint={overdue ? 'Vencida' : undefined}
          />
        </Card>
        <Card>
          <DataPoint
            label="Cobro"
            value={formatPercent(
              Number(invoice.total) > 0 ? (Number(invoice.paid_amount) / Number(invoice.total)) * 100 : null,
            )}
          />
          <ProgressBar
            className="mt-2"
            value={Number(invoice.total) > 0 ? (Number(invoice.paid_amount) / Number(invoice.total)) * 100 : 0}
            tone={Number(invoice.balance) <= 0 ? 'success' : 'accent'}
          />
        </Card>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <InvoiceLines
            projectCode={project.code}
            invoiceId={invoice.id}
            lines={lines}
            currency={invoice.currency}
            editable={editable}
            total={invoice.total}
          />

          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Pagos aplicados</SectionTitle>
            </div>
            {payments.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span>
                      <span className="tabular text-sm">{formatDate(p.payment_date)}</span>
                      <span className="ml-2 text-2xs text-content-muted">
                        {p.method}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </span>
                    </span>
                    <span className="tabular text-sm font-medium text-success">
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle>Datos</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Fecha">{formatDate(invoice.invoice_date)}</Field>
              <Field label="Vencimiento">{formatDate(invoice.due_date)}</Field>
              <Field label="Moneda">{invoice.currency}</Field>
              <Field label="IVA">{formatPercent(invoice.tax_rate, 0)}</Field>
              <Field label="Base imponible">{formatMoney(invoice.subtotal, invoice.currency)}</Field>
              <Field label="Cuota IVA">{formatMoney(invoice.tax, invoice.currency)}</Field>
              {invoice.external_number ? (
                <Field label="Numero del proveedor">{invoice.external_number}</Field>
              ) : null}
            </dl>
            {invoice.sale_id ? (
              <Link href={`${base}/ventas/${invoice.sale_id}`}
                className="mt-4 inline-block text-2xs text-accent hover:underline">
                Ver venta asociada →
              </Link>
            ) : null}
          </Card>

          {invoice.notes ? (
            <Card>
              <SectionTitle>Notas</SectionTitle>
              <p className="text-sm text-content-secondary">{invoice.notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
