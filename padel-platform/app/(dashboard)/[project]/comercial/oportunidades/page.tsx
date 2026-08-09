import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { Card, ErrorState, PageHeader } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Oportunidades' };

/** Embudo comercial en kanban por etapa (§113). */
const STAGES = ['NUEVA', 'CALIFICANDO', 'REUNION', 'COTIZADA', 'NEGOCIACION'] as const;

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;
  const currency = project.default_currency;

  const { data, error } = await supabase
    .from('opportunities')
    .select('id, name, status, estimated_amount, estimated_courts, currency, probability, expected_close_date, next_action, next_action_date, client_id, clients(company_name)')
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .order('expected_close_date', { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader title="Oportunidades" />
        <ErrorState retryHref={`${base}/comercial/oportunidades`} />
      </>
    );
  }

  type Row = {
    id: string; name: string; status: string; estimated_amount: number;
    estimated_courts: number; currency: string; probability: number;
    expected_close_date: string | null; next_action: string | null;
    next_action_date: string | null; client_id: string;
    clients: { company_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const open = rows.filter((r) => STAGES.includes(r.status as never));

  const pipeline = open.reduce((sum, r) => sum + Number(r.estimated_amount), 0);
  const weighted = open.reduce((sum, r) => sum + (Number(r.estimated_amount) * r.probability) / 100, 0);
  const won = rows.filter((r) => r.status === 'GANADA');
  const lost = rows.filter((r) => r.status === 'PERDIDA');
  const winRate = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Oportunidades"
        subtitle={`${open.length} abiertas en ${project.name}`}
        actions={
          can(project, 'opportunities.create') ? (
            <Link href={`${base}/comercial/oportunidades/form`} className="btn-primary">
              <Plus size={15} />
              Nueva oportunidad
            </Link>
          ) : null
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pipeline" value={formatMoney(pipeline, currency, { compact: true })} tone="accent" />
        <KpiCard label="Ponderado" value={formatMoney(weighted, currency, { compact: true })} hint="por probabilidad" />
        <KpiCard label="Canchas estimadas" value={formatNumber(open.reduce((s, r) => s + r.estimated_courts, 0))} />
        <KpiCard
          label="Tasa de exito"
          value={winRate === null ? '—' : `${winRate.toFixed(0)}%`}
          hint={`${won.length} ganadas · ${lost.length} perdidas`}
          tone={winRate !== null && winRate >= 50 ? 'success' : 'default'}
        />
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {STAGES.map((stage) => {
          const items = open.filter((r) => r.status === stage);
          const stageTotal = items.reduce((s, r) => s + Number(r.estimated_amount), 0);

          return (
            <section key={stage} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-2xs font-semibold uppercase tracking-wider text-content-muted">
                  {stage.replace(/_/g, ' ')}
                </h2>
                <span className="tabular text-2xs text-content-muted">{items.length}</span>
              </div>
              <p className="tabular mb-2 px-1 text-2xs text-content-secondary">
                {formatMoney(stageTotal, currency, { compact: true })}
              </p>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded border border-dashed border-line px-3 py-6 text-center text-2xs text-content-muted">
                    Vacio
                  </div>
                ) : (
                  items.map((opp) => {
                    const overdue = opp.next_action_date && opp.next_action_date < today;
                    return (
                      <Card key={opp.id} className="p-3">
                        <Link href={`${base}/comercial/clientes/${opp.client_id}`} className="block hover:text-accent">
                          <p className="truncate text-2xs text-content-muted">
                            {opp.clients?.company_name ?? '—'}
                          </p>
                        </Link>
                        <Link href={`${base}/comercial/oportunidades/form/${opp.id}`}
                          className="mt-0.5 block text-sm leading-snug hover:text-accent">
                          {opp.name}
                        </Link>
                        <p className="tabular mt-1.5 text-sm font-semibold">
                          {formatMoney(opp.estimated_amount, opp.currency as never, { compact: true })}
                          <span className="ml-1.5 text-2xs font-normal text-content-muted">
                            {opp.probability}%
                          </span>
                        </p>
                        {opp.next_action ? (
                          <p className={`mt-1.5 text-2xs ${overdue ? 'text-critical' : 'text-content-muted'}`}>
                            {overdue ? '⚠ ' : ''}
                            {opp.next_action} · {formatDate(opp.next_action_date)}
                          </p>
                        ) : null}
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {won.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-content-muted">
            Cerradas recientemente
          </h2>
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {[...won, ...lost].slice(0, 8).map((opp) => (
                <li key={opp.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{opp.name}</span>
                    <span className="text-2xs text-content-muted">{opp.clients?.company_name}</span>
                  </span>
                  <StatusBadge status={opp.status} />
                  <span className="tabular text-sm">
                    {formatMoney(opp.estimated_amount, opp.currency as never, { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}
