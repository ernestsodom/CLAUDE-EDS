import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, humanize } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Reuniones' };

type Row = {
  id: string; meeting_date: string; start_time: string | null; meeting_type: string;
  status: string; objective: string | null; summary: string | null;
  clients: { company_name: string } | null;
};

export default async function MeetingsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'meetings',
    select: 'id, meeting_date, start_time, meeting_type, status, objective, summary, clients(company_name)',
    projectId: project.id,
    params: sp,
    searchColumns: ['objective'],
    filters: { status: 'status' },
    orderBy: { column: 'meeting_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Reuniones" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'date', header: 'Fecha', cell: (r) => (
      <span className="tabular">{formatDate(r.meeting_date)}
        {r.start_time ? <span className="block text-2xs font-normal text-content-muted">{r.start_time.slice(0,5)}</span> : null}
      </span>
    )},
    { key: 'client', header: 'Cliente', cell: (r) => r.clients?.company_name ?? '—' },
    { key: 'objective', header: 'Objetivo', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{r.objective ?? '—'}</span> },
    { key: 'type', header: 'Tipo', hideOnMobile: true, cell: (r) => humanize(r.meeting_type) },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Reuniones" subtitle={`${total} reuniones`}
        actions={
          can(project, 'meetings.create') ? (
            <Link href={`${base}/comercial/reuniones/form`} className="btn-primary">
              <Plus size={15} />
              Nueva reunion
            </Link>
          ) : null
        }
      />
      <TableToolbar
        placeholder="Buscar por objetivo..."
        filters={[{ name: 'status', label: 'Estado', options: ['PLANIFICADA','CONFIRMADA','REALIZADA','CANCELADA','REPROGRAMADA'].map((s) => ({ value: s, label: s })) }]}
      />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/comercial/reuniones/form/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin reuniones" />
    </>
  );
}
