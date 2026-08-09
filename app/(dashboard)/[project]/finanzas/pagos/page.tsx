import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';

export const metadata: Metadata = { title: 'Pagos' };

type Row = {
  id: string; direction: string; payment_date: string; amount: number; currency: string;
  method: string; reference: string | null;
  invoices: { invoice_number: string } | null;
  clients: { company_name: string } | null;
  suppliers: { company_name: string } | null;
};

export default async function PaymentsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'payments',
    select: 'id, direction, payment_date, amount, currency, method, reference, invoices(invoice_number), clients(company_name), suppliers(company_name)',
    projectId: project.id,
    params: sp,
    searchColumns: ['reference'],
    filters: { direction: 'direction', method: 'method' },
    orderBy: { column: 'payment_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Pagos" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'date', header: 'Fecha', cell: (r) => <span className="tabular">{formatDate(r.payment_date)}</span> },
    { key: 'direction', header: 'Tipo', cell: (r) => (
      <span className={`badge ${r.direction === 'ENTRADA' ? 'border border-success/30 bg-success/15 text-success' : 'border border-warning/30 bg-warning/15 text-warning'}`}>
        {r.direction === 'ENTRADA' ? 'Cobro' : 'Pago'}
      </span>
    )},
    { key: 'party', header: 'Contraparte', cell: (r) => (
      <span className="text-content-secondary">{r.clients?.company_name ?? r.suppliers?.company_name ?? '—'}</span>
    )},
    { key: 'invoice', header: 'Factura', hideOnMobile: true, cell: (r) => r.invoices?.invoice_number ?? '—' },
    { key: 'method', header: 'Metodo', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{humanize(r.method)}</span> },
    { key: 'reference', header: 'Referencia', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.reference ?? '—'}</span> },
    { key: 'amount', header: 'Importe', align: 'right', cell: (r) => (
      <span className={`tabular font-medium ${r.direction === 'ENTRADA' ? 'text-success' : 'text-content'}`}>
        {r.direction === 'ENTRADA' ? '+' : '−'}{formatMoney(r.amount, r.currency as never)}
      </span>
    )},
  ];

  return (
    <>
      <PageHeader title="Pagos" subtitle={`${total} movimientos`} />
      <TableToolbar placeholder="Buscar por referencia..."
        filters={[{ name: 'direction', label: 'Tipo', options: [{ value: 'ENTRADA', label: 'Cobros' }, { value: 'SALIDA', label: 'Pagos' }] }]} />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin pagos registrados" />
    </>
  );
}
