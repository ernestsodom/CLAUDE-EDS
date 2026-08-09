import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle, Banknote, Building2, Clock, Factory, LayoutGrid,
  Package, Ship, Target, TrendingUp, Truck, Wallet,
} from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, ErrorState, PageHeader, ProgressBar, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { CourtFunnel } from '@/components/dashboard/court-funnel';
import { MarginChart } from '@/components/dashboard/margin-chart';
import type { DashboardGlobal, SaleFinancials } from '@/types/database.types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const [kpiRes, salesRes] = await Promise.all([
    supabase
      .from('v_dashboard_global')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle(),
    supabase
      .from('v_sale_financials')
      .select('*')
      .eq('project_id', project.id)
      .not('status', 'in', '("ANULADA","BORRADOR")')
      .order('sale_date', { ascending: false })
      .limit(8),
  ]);

  if (kpiRes.error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState
          description="No se pudieron obtener los indicadores del proyecto."
          retryHref={`${base}/dashboard`}
        />
      </>
    );
  }

  const kpi = kpiRes.data as DashboardGlobal | null;
  const sales = (salesRes.data ?? []) as SaleFinancials[];
  const currency = project.default_currency;
  const showFinance = can(project, 'invoices.view') || can(project, 'profitability.view');
  const showMargin = can(project, 'profitability.view');

  if (!kpi) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle={project.name} />
        <ErrorState
          title="Proyecto sin datos"
          description="Todavia no hay informacion registrada en esta unidad de negocio."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${project.name} · ¿Como esta el negocio hoy?`}
        actions={
          kpi.open_alerts > 0 ? (
            <Link href={`${base}/control-center`} className="btn-secondary">
              <AlertTriangle size={14} className="text-critical" />
              {kpi.open_alerts} alertas
            </Link>
          ) : null
        }
      />

      {/* ---- Linea ejecutiva (§112): las cifras que definen el negocio ---- */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Ventas cerradas"
          value={formatMoney(kpi.closed_sales, currency, { compact: true })}
          hint="Confirmadas y posteriores"
          href={`${base}/ventas?status=CONFIRMADA`}
          tone="accent"
          icon={<Wallet size={15} />}
        />
        <KpiCard
          label="Pipeline"
          value={formatMoney(kpi.pipeline_amount, currency, { compact: true })}
          hint={`${formatMoney(kpi.weighted_pipeline, currency, { compact: true })} ponderado`}
          href={`${base}/comercial/oportunidades`}
          icon={<Target size={15} />}
        />
        {showFinance ? (
          <>
            <KpiCard
              label="Cobrado"
              value={formatMoney(kpi.total_collected, currency, { compact: true })}
              hint={`de ${formatMoney(kpi.total_invoiced_sales, currency, { compact: true })} facturado`}
              href={`${base}/finanzas/pagos`}
              tone="success"
              icon={<Banknote size={15} />}
            />
            <KpiCard
              label="Por cobrar"
              value={formatMoney(kpi.accounts_receivable, currency, { compact: true })}
              hint={
                kpi.overdue_receivable > 0
                  ? `${formatMoney(kpi.overdue_receivable, currency, { compact: true })} vencido`
                  : 'Sin vencidos'
              }
              href={`${base}/finanzas/facturas?kind=VENTA`}
              tone={kpi.overdue_receivable > 0 ? 'critical' : 'default'}
              icon={<Clock size={15} />}
            />
            <KpiCard
              label="Por pagar"
              value={formatMoney(kpi.accounts_payable, currency, { compact: true })}
              hint="Facturas de proveedor"
              href={`${base}/finanzas/facturas?kind=COMPRA`}
              tone={kpi.accounts_payable > 0 ? 'warning' : 'default'}
              icon={<Truck size={15} />}
            />
          </>
        ) : null}
        {showMargin ? (
          <KpiCard
            label="Margen proyectado"
            value={formatPercent(kpi.projected_margin_pct)}
            hint={formatMoney(kpi.projected_margin, currency, { compact: true })}
            href={`${base}/finanzas/rentabilidad`}
            tone={
              kpi.projected_margin_pct !== null && kpi.projected_margin_pct < 15
                ? 'critical'
                : 'success'
            }
            icon={<TrendingUp size={15} />}
          />
        ) : null}
      </section>

      {/* ---- Operaciones: donde estan fisicamente las canchas ---- */}
      <SectionTitle>Operaciones</SectionTitle>
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Canchas vendidas"
          value={formatNumber(kpi.courts_sold)}
          href={`${base}/operaciones/canchas`}
          icon={<LayoutGrid size={15} />}
        />
        <KpiCard
          label="Fabricandose"
          value={formatNumber(kpi.courts_in_production)}
          href={`${base}/operaciones/canchas?status=EN_CONSTRUCCION`}
          tone="accent"
          icon={<Factory size={15} />}
        />
        <KpiCard
          label="En transito"
          value={formatNumber(kpi.courts_in_transit)}
          href={`${base}/operaciones/canchas?status=EN_TRANSITO`}
          icon={<Ship size={15} />}
        />
        <KpiCard
          label="Instalandose"
          value={formatNumber(kpi.courts_installing)}
          href={`${base}/operaciones/canchas?status=EN_INSTALACION`}
          icon={<Package size={15} />}
        />
        <KpiCard
          label="Entregadas"
          value={formatNumber(kpi.courts_delivered)}
          href={`${base}/operaciones/canchas?status=ENTREGADA`}
          tone="success"
        />
        <KpiCard
          label="Por entregar"
          value={formatNumber(kpi.courts_pending_delivery)}
          hint="Vendidas y no entregadas"
          href={`${base}/operaciones/canchas?pending=1`}
          tone={kpi.courts_pending_delivery > 0 ? 'warning' : 'default'}
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <SectionTitle>Embudo operacional</SectionTitle>
          <CourtFunnel
            data={[
              { label: 'Fabricacion', value: kpi.courts_in_production, href: `${base}/operaciones/canchas?status=EN_CONSTRUCCION` },
              { label: 'Transito', value: kpi.courts_in_transit, href: `${base}/operaciones/canchas?status=EN_TRANSITO` },
              { label: 'Instalacion', value: kpi.courts_installing, href: `${base}/operaciones/canchas?status=EN_INSTALACION` },
              { label: 'Entregadas', value: kpi.courts_delivered, href: `${base}/operaciones/canchas?status=ENTREGADA` },
            ]}
          />
        </Card>

        {showMargin ? (
          <Card className="lg:col-span-2">
            <SectionTitle>Margen por venta: estimado vs real</SectionTitle>
            {sales.length > 0 ? (
              <MarginChart
                data={sales
                  .slice()
                  .reverse()
                  .map((s) => ({
                    name: s.sale_number.replace(`${project.code}-`, ''),
                    estimado: s.estimated_margin,
                    real: s.has_actual_cost ? s.actual_margin : null,
                  }))}
                currency={currency}
              />
            ) : (
              <p className="py-8 text-center text-sm text-content-muted">
                Aun no hay ventas registradas.
              </p>
            )}
          </Card>
        ) : null}
      </div>

      {/* ---- Riesgo: lo que requiere decision ---- */}
      <SectionTitle
        action={
          <Link href={`${base}/control-center`} className="text-2xs text-accent hover:underline">
            Ver Control Center →
          </Link>
        }
      >
        Requiere atencion
      </SectionTitle>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Alertas criticas"
          value={formatNumber(kpi.critical_alerts)}
          href={`${base}/control-center`}
          tone={kpi.critical_alerts > 0 ? 'critical' : 'success'}
          icon={<AlertTriangle size={15} />}
        />
        <KpiCard
          label="Proyectos atrasados"
          value={formatNumber(kpi.delayed_manufacturing)}
          href={`${base}/operaciones/fabricacion?delayed=1`}
          tone={kpi.delayed_manufacturing > 0 ? 'warning' : 'success'}
          icon={<Factory size={15} />}
        />
        <KpiCard
          label="Seguimientos vencidos"
          value={formatNumber(kpi.overdue_follow_ups)}
          href={`${base}/comercial/seguimientos?status=VENCIDO`}
          tone={kpi.overdue_follow_ups > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Prospectos"
          value={formatNumber(kpi.prospects)}
          hint={`${kpi.open_opportunities} oportunidades abiertas`}
          href={`${base}/comercial/clientes?status=PROSPECTO`}
          icon={<Building2 size={15} />}
        />
      </section>

      {/* ---- Ventas recientes con su avance real ---- */}
      <SectionTitle
        action={
          <Link href={`${base}/ventas`} className="text-2xs text-accent hover:underline">
            Ver todas →
          </Link>
        }
      >
        Ventas recientes
      </SectionTitle>
      <Card padded={false}>
        {sales.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-content-muted">
            Todavia no hay ventas en {project.name}.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {sales.map((sale) => (
              <li key={sale.sale_id}>
                <Link
                  href={`${base}/ventas/${sale.sale_id}`}
                  className="flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-elevated"
                >
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-medium">{sale.sale_number}</p>
                    <p className="truncate text-2xs text-content-muted">{sale.client_name}</p>
                  </div>

                  <StatusBadge status={sale.status} />

                  <div className="w-28">
                    <p className="tabular text-sm font-semibold">
                      {formatMoney(sale.total_sale, sale.currency)}
                    </p>
                    {showMargin ? (
                      <p className="tabular text-2xs text-content-muted">
                        margen {formatPercent(sale.projected_margin_percentage)}
                      </p>
                    ) : null}
                  </div>

                  <div className="hidden w-40 md:block">
                    <p className="mb-1 text-2xs text-content-muted">
                      {sale.courts_delivered}/{sale.courts_total} entregadas
                    </p>
                    <ProgressBar
                      value={
                        sale.courts_total > 0
                          ? (sale.courts_delivered / sale.courts_total) * 100
                          : 0
                      }
                      tone={sale.delivery_state === 'ENTREGADA' ? 'success' : 'accent'}
                    />
                  </div>

                  {showFinance ? (
                    <div className="hidden w-28 text-right lg:block">
                      <p className="tabular text-sm">
                        {formatMoney(sale.receivable_amount, sale.currency, { compact: true })}
                      </p>
                      <p className="text-2xs text-content-muted">por cobrar</p>
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
