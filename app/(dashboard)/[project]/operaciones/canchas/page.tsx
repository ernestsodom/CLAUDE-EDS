import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatMoney } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Court } from '@/types/database.types';

export const metadata: Metadata = { title: 'Canchas' };

const NEW_COURT_STATUSES = [
  'PLANIFICADA', 'MATERIALES_PENDIENTES', 'EN_CONSTRUCCION', 'CONSTRUCCION_TERMINADA',
  'GALVANIZADO', 'GALVANIZADO_TERMINADO', 'EMBALAJE', 'EMBALADA', 'EN_TRANSITO',
  'EN_INSTALACION', 'INSTALACION_TERMINADA', 'ENTREGADA',
];

const USED_COURT_STATUSES = [
  'DISPONIBLE', 'RESERVADA', 'EN_DESMONTAJE', 'DESMONTADA', 'EN_REPARACION',
  'PREPARADA', 'EN_TRANSPORTE', 'EN_TRANSITO', 'EN_INSTALACION', 'ENTREGADA', 'VENDIDA',
];

export default async function CourtsPage({
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

  // "Por entregar" es un KPI del dashboard: vendidas y todavia no entregadas.
  const pendingOnly = sp.pending === '1';

  const { rows, total, page, pageSize, error } = await fetchList<Court>({
    from: 'courts',
    select: '*',
    projectId: project.id,
    params: sp,
    searchColumns: ['court_number', 'serial_number', 'model'],
    filters: { status: 'status', type: 'court_type' },
    orderBy: { column: 'court_number', ascending: true },
    softDelete: true,
    ...(pendingOnly
      ? { equals: { delivered_at: null } }
      : {}),
  });

  if (error) {
    return (
      <>
        <PageHeader title="Canchas" />
        <ErrorState retryHref={`${base}/operaciones/canchas`} />
      </>
    );
  }

  const statuses = project.court_kind === 'USADA' ? USED_COURT_STATUSES : NEW_COURT_STATUSES;

  const columns: Column<Court>[] = [
    {
      key: 'court_number',
      header: 'Cancha',
      cell: (row) => (
        <span>
          {row.court_number}
          {row.serial_number ? (
            <span className="block text-2xs font-normal text-content-muted">
              {row.serial_number}
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'model', header: 'Modelo', cell: (row) => row.model ?? '—' },
    { key: 'status', header: 'Estado', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'location',
      header: 'Ubicacion',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-content-secondary">
          {row.current_location ?? '—'}
          {row.country ? (
            <span className="ml-1.5 text-2xs text-content-muted">{row.country}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Precio',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular">{formatMoney(row.sale_price, row.currency)}</span>
      ),
    },
    {
      key: 'delivered',
      header: 'Entregada',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-content-muted">{formatDate(row.delivered_at)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Canchas"
        subtitle={
          pendingOnly
            ? `${total} canchas pendientes de entrega`
            : `${total} canchas en ${project.name}`
        }
        actions={
          can(project, 'courts.create') ? (
            <Link href={`${base}/operaciones/canchas/form`} className="btn-primary">
              <Plus size={15} />
              Nueva cancha
            </Link>
          ) : null
        }
      />

      <TableToolbar
        placeholder="Buscar por numero, serie o modelo..."
        filters={[
          {
            name: 'status',
            label: 'Estado',
            options: statuses.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          },
          {
            name: 'type',
            label: 'Tipo',
            options: [
              { value: 'NUEVA', label: 'Nueva' },
              { value: 'USADA', label: 'Usada' },
            ],
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowHref={(row) => `${base}/operaciones/canchas/${row.id}`}
        total={total}
        page={page}
        pageSize={pageSize}
        baseParams={carryParams(sp)}
        emptyTitle="Sin canchas"
        emptyDescription="Las canchas se generan automaticamente al confirmar una venta."
      />
    </>
  );
}
