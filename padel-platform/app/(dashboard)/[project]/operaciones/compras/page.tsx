import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatMoney } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Ordenes de compra' };

type Row = {
  id: string; po_number: string; order_date: string; expected_delivery_date: string | null;
  status: string; currency: string; total: number;
  suppliers: { company_name: string } | null;
};

export default async function PurchaseOrdersPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'purchase_orders',
    select: 'id, po_number, order_date, expected_delivery_date, status, currency, total, suppliers(company_name)',
    projectId: project.id, params: sp,
    searchColumns: ['po_number'],
    filters: { status: 'status' },
    orderBy: { column: 'order_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Ordenes de compra" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Orden', cell: (r) => r.po_number },
    { key: 'supplier', header: 'Proveedor', cell: (r) => <span className="text-content-secondary">{r.suppliers?.company_name ?? '—'}</span> },
    { key: 'date', header: 'Fecha', hideOnMobile: true, cell: (r) => <span className="tabular">{formatDate(r.order_date)}</span> },
    { key: 'eta', header: 'Entrega prevista', hideOnMobile: true, cell: (r) => <span className="tabular text-content-secondary">{formatDate(r.expected_delivery_date)}</span> },
    { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="tabular font-medium">{formatMoney(r.total, r.currency as never)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Ordenes de compra" subtitle={`${total} ordenes`} />
      <TableToolbar placeholder="Buscar orden..."
        filters={[{ name: 'status', label: 'Estado', options: ['BORRADOR','EMITIDA','APROBADA','RECIBIDA','FACTURADA','PAGADA','ANULADA'].map((s) => ({ value: s, label: s })) }]} />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin ordenes de compra" />
    </>
  );
}
