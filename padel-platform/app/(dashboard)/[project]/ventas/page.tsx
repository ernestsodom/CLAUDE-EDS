import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { PageHeader, ProgressBar, ErrorState } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import type { SaleFinancials } from '@/types/database.types';

export const metadata: Metadata = { title: 'Ventas' };

const SALE_STATUSES = [
  'BORRADOR', 'COTIZACION', 'COMPROMETIDA', 'CONFIRMADA', 'EN_PRODUCCION',
  'PARCIALMENTE_ENTREGADA', 'ENTREGADA', 'CERRADA', 'ANULADA',
];

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<ListParams>;
}) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;
  const showMargin = can(project, 'profitability.view');

  const { rows, total, page, pageSize, error } = await fetchList<SaleFinancials>({
    from: 'v_sale_financials',
    select: '*',
    projectId: project.id,
    params: sp,
    searchColumns: ['sale_number', 'client_name'],
    filters: { status: 'status' },
    orderBy: { column: 'sale_date', ascending: false },
  });

  if (error) {
    return (
      <>
        <PageHeader title="Ventas" />
        <ErrorState retryHref={`${base}/ventas`} />
      </>
    );
  }

  const columns: Column<SaleFinancials & { id?: string }>[] = [
    {
      key: 'sale_number',
      header: 'Venta',
      cell: (row) => (
        <span>
          {row.sale_number}
          <span className="block text-2xs font-normal text-content-muted">
            {formatDate(row.sale_date)}
          </span>
        </span>
      ),
    },
    {
      key: 'client',
      header: 'Cliente',
      cell: (row) => (
        <span className="truncate">
          {row.client_name}
          {row.client_country ? (
            <span className="ml-1.5 text-2xs text-content-muted">{row.client_country}</span>
          ) : null}
        </span>
      ),
    },
    { key: 'status', header: 'Estado', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'total',
      header: 'Importe',
      align: 'right',
      cell: (row) => (
        <span className="tabular font-medium">{formatMoney(row.total_sale, row.currency)}</span>
      ),
    },
    {
      key: 'courts',
      header: 'Canchas',
      align: 'center',
      hideOnMobile: true,
      cell: (row) => (
        <div className="mx-auto w-24">
          <p className="tabular mb-1 text-2xs text-content-muted">
            {row.courts_delivered}/{row.courts_total}
          </p>
          <ProgressBar
            value={row.courts_total > 0 ? (row.courts_delivered / row.courts_total) * 100 : 0}
            tone={row.delivery_state === 'ENTREGADA' ? 'success' : 'accent'}
          />
        </div>
      ),
    },
    {
      key: 'receivable',
      header: 'Por cobrar',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className={row.receivable_amount > 0 ? 'tabular text-warning' : 'tabular text-content-muted'}>
          {formatMoney(row.receivable_amount, row.currency)}
        </span>
      ),
    },
    ...(showMargin
      ? [
          {
            key: 'margin',
            header: 'Margen',
            align: 'right' as const,
            hideOnMobile: true,
            cell: (row: SaleFinancials) => {
              const pct = row.projected_margin_percentage;
              const tone =
                pct === null ? 'text-content-muted'
                  : pct < 15 ? 'text-critical'
                  : pct < 25 ? 'text-warning'
                  : 'text-success';
              return (
                <span className={`tabular font-medium ${tone}`}>
                  {formatPercent(pct)}
                  {!row.has_actual_cost ? (
                    <span className="ml-1 text-2xs text-content-muted">est.</span>
                  ) : null}
                </span>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Ventas"
        subtitle={`${total} ventas en ${project.name}`}
      />

      <TableToolbar
        placeholder="Buscar por numero de venta o cliente..."
        filters={[
          {
            name: 'status',
            label: 'Estado',
            options: SALE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows.map((r) => ({ ...r, id: r.sale_id }))}
        rowHref={(row) => `${base}/ventas/${row.sale_id}`}
        total={total}
        page={page}
        pageSize={pageSize}
        baseParams={carryParams(sp)}
        emptyTitle="Sin ventas"
        emptyDescription="No hay ventas que coincidan con los filtros aplicados."
      />
    </>
  );
}
