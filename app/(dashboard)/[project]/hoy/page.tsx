import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, humanize } from '@/lib/format';
import { Card, EmptyState, ErrorState, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import type { AgendaItem } from '@/types/database.types';

export const metadata: Metadata = { title: 'Hoy' };

/**
 * HOY y PROXIMOS 7 DIAS (§110, §111).
 *
 * Un unico feed (`v_agenda`) que une reuniones, seguimientos,
 * instalaciones, despachos, entregas, vencimientos de factura y contrato
 * y tareas. El usuario no tiene que recorrer siete modulos para saber que
 * le toca hoy.
 */
const KIND_ROUTE: Record<string, string> = {
  REUNION: 'comercial/reuniones',
  SEGUIMIENTO: 'comercial/seguimientos',
  INSTALACION: 'operaciones/instalaciones',
  DESPACHO: 'operaciones/logistica',
  ENTREGA: 'ventas',
  VENCIMIENTO_FACTURA: 'finanzas/facturas',
  VENCIMIENTO_CONTRATO: 'finanzas/contratos',
  TAREA: 'tareas',
};

export default async function TodayPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in7 = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('v_agenda')
    .select('*')
    .eq('project_id', project.id)
    .not('event_date', 'is', null)
    .lte('event_date', in7)
    .order('event_date', { ascending: true });

  if (error) {
    return (
      <>
        <PageHeader title="Hoy" />
        <ErrorState retryHref={`${base}/hoy`} />
      </>
    );
  }

  const items = (data ?? []) as AgendaItem[];
  const overdue = items.filter((i) => i.event_date! < todayStr);
  const todayItems = items.filter((i) => i.event_date === todayStr);
  const upcoming = items.filter((i) => i.event_date! > todayStr);

  function renderList(list: AgendaItem[]) {
    return (
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {list.map((item) => {
            const route = KIND_ROUTE[item.kind];
            const href = route ? `${base}/${route}/${item.entity_id}` : null;
            const content = (
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-32 shrink-0 text-2xs uppercase tracking-wide text-content-muted">
                  {humanize(item.kind)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                <StatusBadge status={item.priority} />
                <time className="tabular w-20 shrink-0 text-right text-2xs text-content-muted">
                  {formatDate(item.event_date)}
                </time>
              </div>
            );
            return (
              <li key={`${item.kind}-${item.entity_id}`}>
                {href ? (
                  <Link href={href} className="block transition-colors hover:bg-elevated">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Hoy"
        subtitle={formatDate(today, 'long')}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={28} strokeWidth={1.5} className="text-success" />}
          title="Nada agendado"
          description="No hay reuniones, seguimientos, despachos ni vencimientos en los proximos 7 dias."
        />
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 ? (
            <section>
              <SectionTitle>Vencido ({overdue.length})</SectionTitle>
              {renderList(overdue)}
            </section>
          ) : null}

          <section>
            <SectionTitle>Hoy ({todayItems.length})</SectionTitle>
            {todayItems.length === 0 ? (
              <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-content-muted">
                Sin eventos para hoy.
              </p>
            ) : (
              renderList(todayItems)
            )}
          </section>

          {upcoming.length > 0 ? (
            <section>
              <SectionTitle>Proximos 7 dias ({upcoming.length})</SectionTitle>
              {renderList(upcoming)}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
