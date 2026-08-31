import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, CalendarClock, CircleDollarSign, LayoutGrid, Handshake } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { DEAL_STATUSES } from '@/lib/validations/deals';
import type { DealBoardRow } from '@/types/database.types';

export const metadata: Metadata = { title: 'Negocios' };

/**
 * Tablero del trader.
 *
 * Es la pantalla de trabajo del proyecto ATILA y esta pensada para
 * responder de un vistazo a lo unico que importa aqui: que negocios hay,
 * cuantas canchas suman, cuanta comision representan y que fechas hay
 * comprometidas. Nada de fabricacion, materiales ni margenes del cliente:
 * ese detalle es de otra unidad de negocio.
 */
export default async function DealsPage({
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

  if (!can(project, 'deals.view')) {
    return (
      <>
        <PageHeader title="Negocios" />
        <ErrorState title="Sin acceso" description="Tu rol no permite ver los negocios de este proyecto." />
      </>
    );
  }

  const supabase = await createClient();

  const [list, totals] = await Promise.all([
    fetchList<DealBoardRow>({
      from: 'v_deal_board',
      select: '*',
      projectId: project.id,
      params: sp,
      searchColumns: ['client_name', 'code', 'city'],
      filters: { status: 'status' },
      orderBy: { column: 'opened_at', ascending: false },
    }),
    supabase
      .from('v_deal_board')
      .select('status, courts_count, total_commission_usd, delivery_date')
      .eq('project_id', project.id),
  ]);

  if (list.error) {
    return (
      <>
        <PageHeader title="Negocios" />
        <ErrorState retryHref={`${base}/negocios`} />
      </>
    );
  }

  // Los KPIs miran TODOS los negocios, no solo la pagina visible: un
  // indicador que cambia al pasar de pagina no sirve para decidir nada.
  const all = (totals.data ?? []) as {
    status: string; courts_count: number; total_commission_usd: number; delivery_date: string | null;
  }[];

  const open = all.filter((d) => d.status === 'POTENCIAL' || d.status === 'EN_NEGOCIACION');
  const closed = all.filter((d) => d.status === 'CERRADA' || d.status === 'ENTREGADA');
  const sum = (rows: typeof all, key: 'courts_count' | 'total_commission_usd') =>
    rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

  const nextDelivery = closed
    .filter((d) => d.delivery_date)
    .map((d) => d.delivery_date as string)
    .sort()[0];

  const columns: Column<DealBoardRow & { id?: string }>[] = [
    {
      key: 'client',
      header: 'Cliente / club',
      cell: (row) => (
        <span>
          <span className="block font-medium">{row.client_name}</span>
          <span className="block text-2xs text-content-muted">
            {row.code}
            {row.city ? ` · ${row.city}` : ''}
            {row.country ? ` (${row.country})` : ''}
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Estado', cell: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'mix',
      header: 'Canchas',
      cell: (row) => (
        <span>
          <span className="tabular font-medium">{row.courts_count}</span>
          <span className="block text-2xs text-content-muted">{row.court_mix}</span>
        </span>
      ),
    },
    {
      key: 'custom',
      header: 'Personalizadas',
      align: 'center',
      hideOnMobile: true,
      cell: (row) =>
        row.custom_courts > 0 ? (
          <span className="badge border border-accent/30 bg-accent/15 text-accent">
            {row.custom_courts}
          </span>
        ) : (
          <span className="text-2xs text-content-muted">—</span>
        ),
    },
    {
      key: 'commission',
      header: 'Comision',
      align: 'right',
      cell: (row) => (
        <span className="tabular font-medium">
          {formatMoney(row.total_commission_usd, 'USD')}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Entrega',
      align: 'right',
      cell: (row) => {
        // La regla del negocio, visible: sin venta cerrada no hay fecha.
        if (!row.delivery_date) {
          return (
            <span className="text-2xs text-content-muted">
              {row.expected_close_date ? `cierre est. ${formatDate(row.expected_close_date)}` : 'sin cerrar'}
            </span>
          );
        }
        const late = (row.days_to_delivery ?? 0) < 0;
        return (
          <span>
            <span className="tabular block">{formatDate(row.delivery_date)}</span>
            <span className={`block text-2xs ${late ? 'text-critical' : 'text-content-muted'}`}>
              {late
                ? `${Math.abs(row.days_to_delivery ?? 0)} d de retraso`
                : `en ${row.days_to_delivery} d`}
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Negocios"
        subtitle={`${list.total} registrados en ${project.name}`}
        actions={
          can(project, 'deals.create') ? (
            <Link href={`${base}/negocios/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo negocio
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="En curso"
          value={formatNumber(open.length)}
          hint={`${formatNumber(sum(open, 'courts_count'))} canchas potenciales`}
          href={`${base}/negocios?status=EN_NEGOCIACION`}
          icon={<Handshake size={15} />}
        />
        <KpiCard
          label="Comision potencial"
          value={formatMoney(sum(open, 'total_commission_usd'), 'USD', { compact: true })}
          hint="negocios sin cerrar"
          tone="warning"
          icon={<CircleDollarSign size={15} />}
        />
        <KpiCard
          label="Comision cerrada"
          value={formatMoney(sum(closed, 'total_commission_usd'), 'USD', { compact: true })}
          hint={`${formatNumber(sum(closed, 'courts_count'))} canchas vendidas`}
          href={`${base}/negocios?status=CERRADA`}
          tone="success"
          icon={<LayoutGrid size={15} />}
        />
        <KpiCard
          label="Proxima entrega"
          value={nextDelivery ? formatDate(nextDelivery) : '—'}
          hint={nextDelivery ? 'venta cerrada' : 'sin entregas comprometidas'}
          tone="accent"
          icon={<CalendarClock size={15} />}
        />
      </div>

      <TableToolbar
        placeholder="Buscar club, codigo o ciudad..."
        filters={[
          {
            name: 'status',
            label: 'Estado',
            options: DEAL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
          },
        ]}
      />

      <DataTable
        columns={columns}
        rows={list.rows.map((r) => ({ ...r, id: r.deal_id }))}
        rowHref={(row) => `${base}/negocios/${row.deal_id}`}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        baseParams={carryParams(sp)}
        emptyTitle="Sin negocios"
        emptyDescription="Registra el primer negocio potencial para empezar a seguirlo."
      />
    </>
  );
}
