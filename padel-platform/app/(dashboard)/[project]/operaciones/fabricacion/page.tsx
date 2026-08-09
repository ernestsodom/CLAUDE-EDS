import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { Card, EmptyState, ErrorState, PageHeader, ProgressBar } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ManufacturingSummary } from '@/types/database.types';

export const metadata: Metadata = { title: 'Fabricacion' };

export default async function ManufacturingPage({
  params, searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ delayed?: string }>;
}) {
  const { project: projectCode } = await params;
  const { delayed } = await searchParams;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  let query = supabase
    .from('v_manufacturing_summary')
    .select('*')
    .eq('project_id', project.id)
    .order('estimated_completion_date', { ascending: true });

  if (delayed === '1') query = query.eq('is_delayed', true);

  const { data, error } = await query;
  if (error) return (<><PageHeader title="Fabricacion" /><ErrorState retryHref={`${base}/operaciones/fabricacion`} /></>);

  const rows = (data ?? []) as ManufacturingSummary[];
  const active = rows.filter((r) => !['TERMINADO', 'CANCELADO'].includes(r.status));
  const late = rows.filter((r) => r.is_delayed);
  const missingMaterials = rows.filter((r) => Number(r.materials_missing) > 0);

  return (
    <>
      <PageHeader
        title="Fabricacion"
        subtitle={delayed === '1' ? `${rows.length} proyectos atrasados` : `${active.length} proyectos activos`}
        actions={
          can(project, 'manufacturing.create') ? (
            <Link href={`${base}/operaciones/fabricacion/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo proyecto
            </Link>
          ) : null
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Activos" value={formatNumber(active.length)} tone="accent" />
        <KpiCard label="Atrasados" value={formatNumber(late.length)}
          href={`${base}/operaciones/fabricacion?delayed=1`}
          tone={late.length > 0 ? 'critical' : 'success'} />
        <KpiCard label="Con faltantes" value={formatNumber(missingMaterials.length)}
          href={`${base}/operaciones/materiales`}
          tone={missingMaterials.length > 0 ? 'warning' : 'success'} />
        <KpiCard label="Canchas en produccion"
          value={formatNumber(active.reduce((s, r) => s + Number(r.courts_count), 0))} />
      </section>

      {rows.length === 0 ? (
        <EmptyState title="Sin proyectos de fabricacion"
          description="Se crean automaticamente al confirmar una venta de canchas nuevas." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((mp) => (
            <Card key={mp.manufacturing_project_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug">{mp.name}</h3>
                <StatusBadge status={mp.status} />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-2xs text-content-muted">
                  <span>{mp.courts_built}/{mp.courts_count} canchas</span>
                  <span className="tabular">{formatPercent(mp.progress_pct, 0)}</span>
                </div>
                <ProgressBar value={mp.progress_pct} tone={mp.is_delayed ? 'critical' : 'accent'} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <dt className="text-content-muted">Entrega estimada</dt>
                  <dd className={mp.is_delayed ? 'text-critical' : 'text-content-secondary'}>
                    {formatDate(mp.estimated_completion_date)}
                    {mp.is_delayed ? ' ⚠' : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-content-muted">Materiales faltantes</dt>
                  <dd className={Number(mp.materials_missing) > 0 ? 'text-warning' : 'text-content-secondary'}>
                    {formatNumber(Number(mp.materials_missing))}
                  </dd>
                </div>
              </dl>

              {mp.sale_id ? (
                <Link href={`${base}/ventas/${mp.sale_id}`} className="mt-3 inline-block text-2xs text-accent hover:underline">
                  Ver venta asociada →
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
