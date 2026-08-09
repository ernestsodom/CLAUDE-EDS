import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Facturas' };

type Row = {
  id: string; kind: string; invoice_number: string; external_number: string | null;
  invoice_date: string; due_date: string | null; status: string; currency: string;
  total: number; paid_amount: number; balance: number; sale_id: string | null;
  clients: { company_name: string } | null;
  suppliers: { company_name: string } | null;
};

export default async function InvoicesPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;
  const today = new Date().toISOString().slice(0, 10);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'invoices',
    select: 'id, kind, invoice_number, external_number, invoice_date, due_date, status, currency, total, paid_amount, balance, sale_id, clients(company_name), suppliers(company_name)',
    projectId: project.id,
    params: sp,
    searchColumns: ['invoice_number', 'external_number'],
    filters: { kind: 'kind', status: 'status' },
    orderBy: { column: 'invoice_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Facturas" /><ErrorState retryHref={`${base}/finanzas/facturas`} /></>);

  // Totales del proyecto (independientes de la pagina visible)
  const supabase = await createClient();
  const { data: fin } = await supabase
    .from('v_financial_summary').select('*').eq('project_id', project.id).maybeSingle();

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Factura', cell: (r) => (
      <span>{r.invoice_number}
        {r.external_number ? <span className="block text-2xs font-normal text-content-muted">{r.external_number}</span> : null}
      </span>
    )},
    { key: 'party', header: 'Contraparte', cell: (r) => (
      <span className="text-content-secondary">
        {r.kind === 'VENTA' ? r.clients?.company_name : r.suppliers?.company_name}
        <span className="ml-1.5 text-2xs text-content-muted">{r.kind === 'VENTA' ? 'cliente' : 'proveedor'}</span>
      </span>
    )},
    { key: 'date', header: 'Fecha', hideOnMobile: true, cell: (r) => <span className="tabular">{formatDate(r.invoice_date)}</span> },
    { key: 'due', header: 'Vence', cell: (r) => {
      const overdue = r.due_date && r.due_date < today && Number(r.balance) > 0;
      return <span className={`tabular ${overdue ? 'text-critical' : 'text-content-secondary'}`}>{formatDate(r.due_date)}</span>;
    }},
    { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="tabular">{formatMoney(r.total, r.currency as never)}</span> },
    { key: 'balance', header: 'Saldo', align: 'right', cell: (r) => (
      <span className={`tabular font-medium ${Number(r.balance) > 0 ? 'text-warning' : 'text-success'}`}>
        {formatMoney(r.balance, r.currency as never)}
      </span>
    )},
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'sale', header: '', align: 'right', hideOnMobile: true, cell: (r) =>
      r.sale_id ? <Link href={`${base}/ventas/${r.sale_id}`} className="text-2xs text-accent hover:underline">venta →</Link> : null },
  ];

  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle={`${total} facturas en ${project.name}`}
        actions={
          can(project, 'invoices.create') ? (
            <Link href={`${base}/finanzas/facturas/form`} className="btn-primary">
              <Plus size={15} />
              Nueva factura
            </Link>
          ) : null
        }
      />

      {fin ? (
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Facturado" value={formatMoney(fin.total_invoiced_sales, project.default_currency, { compact: true })} />
          <KpiCard label="Cobrado" value={formatMoney(fin.total_collected, project.default_currency, { compact: true })} tone="success" />
          <KpiCard label="Por cobrar" value={formatMoney(fin.accounts_receivable, project.default_currency, { compact: true })}
            hint={fin.overdue_receivable > 0 ? `${formatMoney(fin.overdue_receivable, project.default_currency, { compact: true })} vencido` : 'sin vencidos'}
            tone={fin.overdue_receivable > 0 ? 'critical' : 'default'} />
          <KpiCard label="Por pagar" value={formatMoney(fin.accounts_payable, project.default_currency, { compact: true })}
            tone={fin.accounts_payable > 0 ? 'warning' : 'default'} />
        </section>
      ) : null}

      <TableToolbar
        placeholder="Buscar por numero de factura..."
        filters={[
          { name: 'kind', label: 'Tipo', options: [{ value: 'VENTA', label: 'Venta' }, { value: 'COMPRA', label: 'Compra' }] },
          { name: 'status', label: 'Estado', options: ['BORRADOR','EMITIDA','ENVIADA','PARCIALMENTE_PAGADA','PAGADA','VENCIDA','ANULADA'].map((s) => ({ value: s, label: s.replace(/_/g,' ') })) },
        ]}
      />

      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/finanzas/facturas/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin facturas" />
    </>
  );
}
