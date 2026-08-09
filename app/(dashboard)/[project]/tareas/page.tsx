import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { can } from '@/lib/permissions';
import { formatDate, humanize } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { TaskStatusControl } from '@/components/operations/task-status-control';

export const metadata: Metadata = { title: 'Tareas' };

type Row = {
  id: string; title: string; description: string | null; due_date: string | null;
  priority: string; status: string; related_entity_type: string | null;
};

export default async function TasksPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'tasks',
    select: 'id, title, description, due_date, priority, status, related_entity_type',
    projectId: project.id,
    params: sp,
    searchColumns: ['title'],
    filters: { status: 'status', priority: 'priority' },
    orderBy: { column: 'due_date', ascending: true },
  });

  if (error) return (<><PageHeader title="Tareas" /><ErrorState /></>);
  const editable = can(project, 'tasks.update');

  const columns: Column<Row>[] = [
    { key: 'title', header: 'Tarea', cell: (r) => (
      <span>{r.title}
        {r.description ? <span className="block truncate text-2xs font-normal text-content-muted">{r.description}</span> : null}
      </span>
    )},
    { key: 'origin', header: 'Origen', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{humanize(r.related_entity_type)}</span> },
    { key: 'due', header: 'Vence', cell: (r) => <span className="tabular">{formatDate(r.due_date)}</span> },
    { key: 'priority', header: 'Prioridad', cell: (r) => <StatusBadge status={r.priority} /> },
    { key: 'status', header: 'Estado', cell: (r) =>
      editable ? <TaskStatusControl projectCode={project.code} taskId={r.id} status={r.status} />
               : <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Tareas" subtitle={`${total} tareas`} />
      <TableToolbar
        placeholder="Buscar tarea..."
        filters={[
          { name: 'status', label: 'Estado', options: ['PENDIENTE','EN_CURSO','BLOQUEADA','COMPLETADA','CANCELADA'].map((s) => ({ value: s, label: s })) },
          { name: 'priority', label: 'Prioridad', options: ['CRITICA','ALTA','MEDIA','BAJA'].map((s) => ({ value: s, label: s })) },
        ]}
      />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin tareas"
        emptyDescription="Las alertas del Control Center se pueden convertir en tareas." />
    </>
  );
}
