import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Instalaciones' };

type Row = {
  id: string; installation_number: string; name: string | null; city: string | null;
  country: string | null; planned_start_date: string | null; planned_end_date: string | null;
  actual_end_date: string | null; status: string;
  clients: { company_name: string } | null;
};

export default async function InstallationsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'installations',
    select: 'id, installation_number, name, city, country, planned_start_date, planned_end_date, actual_end_date, status, clients(company_name)',
    projectId: project.id, params: sp,
    searchColumns: ['installation_number', 'name'],
    filters: { status: 'status' },
    orderBy: { column: 'planned_start_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Instalaciones" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Instalacion', cell: (r) => (
      <span>{r.installation_number}
        {r.name ? <span className="block text-2xs font-normal text-content-muted">{r.name}</span> : null}
      </span>
    )},
    { key: 'client', header: 'Cliente', cell: (r) => <span className="text-content-secondary">{r.clients?.company_name ?? '—'}</span> },
    { key: 'location', header: 'Ubicacion', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{[r.city, r.country].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'start', header: 'Inicio', cell: (r) => <span className="tabular">{formatDate(r.planned_start_date)}</span> },
    { key: 'end', header: 'Fin previsto', hideOnMobile: true, cell: (r) => <span className="tabular text-content-secondary">{formatDate(r.planned_end_date)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Instalaciones" subtitle={`${total} instalaciones`} />
      <TableToolbar placeholder="Buscar instalacion..."
        filters={[{ name: 'status', label: 'Estado', options: ['PLANIFICADA','CONFIRMADA','EN_CURSO','PAUSADA','TERMINADA','RECEPCIONADA','CANCELADA'].map((s) => ({ value: s, label: s })) }]} />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/operaciones/instalaciones/${r.id}`}
        total={total} page={page} pageSize={pageSize} baseParams={carryParams(sp)}
        emptyTitle="Sin instalaciones" />
    </>
  );
}
