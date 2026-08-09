import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { AlertCard } from '@/components/dashboard/alert-card';
import type { ControlCenterAlert } from '@/types/database.types';

export const metadata: Metadata = { title: 'Control Center' };

/**
 * Control Center (§63).
 *
 * Responde una sola pregunta: que requiere atencion hoy. Las alertas las
 * genera el motor en PostgreSQL (`app.generate_alerts()`), no el
 * frontend: si nadie abre esta pantalla, los problemas se detectan igual.
 */
const BUCKETS = [
  {
    key: 'CRITICO' as const,
    title: 'Critico',
    description: 'Requiere accion inmediata',
    dot: 'bg-critical',
  },
  {
    key: 'IMPORTANTE' as const,
    title: 'Importante',
    description: 'Requiere atencion proxima',
    dot: 'bg-warning',
  },
  {
    key: 'PROXIMO' as const,
    title: 'Proximo',
    description: 'Eventos y vencimientos cercanos',
    dot: 'bg-info',
  },
];

export default async function ControlCenterPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_control_center')
    .select('*')
    .eq('project_id', project.id)
    .order('priority', { ascending: true })
    .order('last_detected_at', { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Control Center" />
        <ErrorState retryHref={`/${project.code}/control-center`} />
      </>
    );
  }

  const alerts = (data ?? []) as ControlCenterAlert[];
  const canCreateTask = can(project, 'tasks.create');

  return (
    <>
      <PageHeader
        title="Control Center"
        subtitle={
          alerts.length === 0
            ? 'Nada requiere atencion en este momento'
            : `${alerts.length} situaciones abiertas en ${project.name}`
        }
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} strokeWidth={1.5} className="text-success" />}
          title="Todo en orden"
          description="No hay fabricaciones atrasadas, facturas vencidas, materiales faltantes ni desviaciones de costo."
        />
      ) : (
        <div className="space-y-8">
          {BUCKETS.map((bucket) => {
            const items = alerts.filter((a) => a.bucket === bucket.key);
            if (items.length === 0) return null;

            return (
              <section key={bucket.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${bucket.dot}`} aria-hidden />
                  <h2 className="text-sm font-semibold">{bucket.title}</h2>
                  <span className="tabular text-2xs text-content-muted">({items.length})</span>
                  <span className="text-2xs text-content-muted">· {bucket.description}</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      projectCode={project.code}
                      canCreateTask={canCreateTask}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
