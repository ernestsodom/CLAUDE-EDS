import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { CompleteFollowUpButton } from '@/components/commercial/complete-follow-up-button';

export const metadata: Metadata = { title: 'Seguimientos' };

type Row = {
  id: string; title: string; description: string | null; due_date: string;
  priority: string; status: string; client_id: string | null;
  clients: { company_name: string } | null;
};

export default async function FollowUpsPage({
  params, searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<ListParams>;
}) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'follow_ups',
    select: 'id, title, description, due_date, priority, status, client_id, clients(company_name)',
    projectId: project.id,
    params: sp,
    searchColumns: ['title'],
    filters: { status: 'status', priority: 'priority' },
    orderBy: { column: 'due_date', ascending: true },
  });

  if (error) {
    return (<><PageHeader title="Seguimientos" /><ErrorState retryHref={`${base}/comercial/seguimientos`} /></>);
  }

  const editable = can(project, 'follow_ups.update');

  const columns: Column<Row>[] = [
    { key: 'title', header: 'Seguimiento', cell: (r) => r.title },
    { key: 'client', header: 'Cliente', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{r.clients?.company_name ?? '—'}</span> },
    { key: 'due', header: 'Vence', cell: (r) => <span className="tabular">{formatDate(r.due_date)}</span> },
    { key: 'priority', header: 'Prioridad', cell: (r) => <StatusBadge status={r.priority} /> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (r) =>
        editable && r.status !== 'COMPLETADO' ? (
          <CompleteFollowUpButton projectCode={project.code} followUpId={r.id} />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Seguimientos" subtitle={`${total} seguimientos`} />
      <TableToolbar
        placeholder="Buscar seguimiento..."
        filters={[
          { name: 'status', label: 'Estado', options: ['PENDIENTE','EN_CURSO','VENCIDO','COMPLETADO','CANCELADO'].map((s) => ({ value: s, label: s })) },
          { name: 'priority', label: 'Prioridad', options: ['CRITICA','ALTA','MEDIA','BAJA'].map((s) => ({ value: s, label: s })) },
        ]}
      />
      <DataTable
        columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)}
        emptyTitle="Sin seguimientos"
        emptyDescription="No hay seguimientos que coincidan con los filtros."
      />
    </>
  );
}
