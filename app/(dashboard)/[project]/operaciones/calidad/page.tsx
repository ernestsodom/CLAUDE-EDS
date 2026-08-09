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

export const metadata: Metadata = { title: 'Calidad' };

type Row = {
  id: string; check_type: string; check_date: string; result: string;
  score: number | null; observations: string | null;
  courts: { court_number: string } | null;
};

export default async function QualityPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'quality_checks',
    select: 'id, check_type, check_date, result, score, observations, courts(court_number)',
    projectId: project.id, params: sp,
    filters: { result: 'result' },
    orderBy: { column: 'check_date', ascending: false },
  });

  if (error) return (<><PageHeader title="Calidad" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'date', header: 'Fecha', cell: (r) => <span className="tabular">{formatDate(r.check_date)}</span> },
    { key: 'court', header: 'Cancha', cell: (r) => r.courts?.court_number ?? '—' },
    { key: 'type', header: 'Control', cell: (r) => <span className="text-content-secondary">{humanize(r.check_type)}</span> },
    { key: 'score', header: 'Puntuacion', align: 'right', hideOnMobile: true, cell: (r) => <span className="tabular">{r.score ?? '—'}</span> },
    { key: 'obs', header: 'Observaciones', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.observations ?? '—'}</span> },
    { key: 'result', header: 'Resultado', cell: (r) => <StatusBadge status={r.result} /> },
  ];

  return (
    <>
      <PageHeader title="Control de calidad" subtitle={`${total} controles`}
        actions={
          can(project, 'quality.create') ? (
            <Link href={`${base}/operaciones/calidad/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo control
            </Link>
          ) : null
        }
      />
      <TableToolbar placeholder="Buscar control..."
        filters={[{ name: 'result', label: 'Resultado', options: ['PENDIENTE','APROBADO','RECHAZADO','CORREGIR'].map((s) => ({ value: s, label: s })) }]} />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/operaciones/calidad/form/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin controles de calidad" />
    </>
  );
}
