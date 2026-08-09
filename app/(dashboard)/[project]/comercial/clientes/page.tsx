import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { can } from '@/lib/permissions';
import { formatMoney, formatRelative } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { CLIENT_STATUSES } from '@/lib/validations/commercial';
import type { Client360 } from '@/types/database.types';

export const metadata: Metadata = { title: 'Clientes' };

export default async function ClientsPage({
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

  const { rows, total, page, pageSize, error } = await fetchList<Client360>({
    from: 'v_client_360',
    select: '*',
    projectId: project.id,
    params: sp,
    searchColumns: ['company_name'],
    filters: { status: 'status', country: 'country' },
    orderBy: { column: 'total_sold', ascending: false },
  });

  if (error) {
    return (
      <>
        <PageHeader title="Clientes" />
        <ErrorState retryHref={`${base}/comercial/clientes`} />
      </>
    );
  }

  const columns: Column<Client360 & { id?: string }>[] = [
    { key: 'name', header: 'Cliente', cell: (row) => row.company_name },
    { key: 'status', header: 'Estado', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'country',
      header: 'Pais',
      hideOnMobile: true,
      cell: (row) => <span className="text-content-secondary">{row.country ?? '—'}</span>,
    },
    {
      key: 'pipeline',
      header: 'Pipeline',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular">
          {formatMoney(row.open_pipeline, project.default_currency, { compact: true })}
        </span>
      ),
    },
    {
      key: 'sold',
      header: 'Vendido',
      align: 'right',
      cell: (row) => (
        <span className="tabular font-medium">
          {formatMoney(row.total_sold, project.default_currency, { compact: true })}
        </span>
      ),
    },
    {
      key: 'receivable',
      header: 'Por cobrar',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className={row.receivable > 0 ? 'tabular text-warning' : 'tabular text-content-muted'}>
          {formatMoney(row.receivable, project.default_currency, { compact: true })}
        </span>
      ),
    },
    {
      key: 'follow',
      header: 'Seguimiento',
      align: 'center',
      hideOnMobile: true,
      cell: (row) =>
        row.overdue_follow_ups > 0 ? (
          <span className="badge border border-critical/30 bg-critical/15 text-critical">
            {row.overdue_follow_ups} vencido{row.overdue_follow_ups > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-2xs text-content-muted">
            {row.last_activity_at ? formatRelative(row.last_activity_at) : 'sin actividad'}
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${total} registros en ${project.name}`}
        actions={
          can(project, 'clients.create') ? (
            <Link href={`${base}/comercial/clientes/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo cliente
            </Link>
          ) : null
        }
      />

      <TableToolbar
        placeholder="Buscar cliente..."
        filters={[
          {
            name: 'status',
            label: 'Estado',
            options: CLIENT_STATUSES.map((s) => ({ value: s, label: s })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows.map((r) => ({ ...r, id: r.client_id }))}
        rowHref={(row) => `${base}/comercial/clientes/${row.client_id}`}
        total={total}
        page={page}
        pageSize={pageSize}
        baseParams={carryParams(sp)}
        emptyTitle="Sin clientes"
        emptyDescription="Todavia no hay clientes registrados en esta unidad de negocio."
      />
    </>
  );
}
