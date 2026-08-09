import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatMoney, formatPercent } from '@/lib/format';
import { Card, ErrorState, PageHeader, ProgressBar, SectionTitle } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { MarginChart } from '@/components/dashboard/margin-chart';
import type { SaleFinancials } from '@/types/database.types';

export const metadata: Metadata = { title: 'Rentabilidad' };

/** Dashboard de rentabilidad (§51, §52, §53). */
export default async function ProfitabilityPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);

  if (!can(project, 'profitability.view')) {
    return (
      <>
        <PageHeader title="Rentabilidad" />
        <ErrorState
          title="Sin acceso"
          description="Tu rol no incluye la visualizacion de margenes en esta unidad de negocio."
        />
      </>
    );
  }

  const supabase = await createClient();
  const base = `/${project.code}`;
  const currency = project.default_currency;

  const { data, error } = await supabase
    .from('v_sale_financials')
    .select('*')
    .eq('project_id', project.id)
    .not('status', 'in', '("ANULADA","BORRADOR")')
    .order('sale_date', { ascending: false });

  if (error) {
    return (
      <>
        <PageHeader title="Rentabilidad" />
        <ErrorState retryHref={`${base}/finanzas/rentabilidad`} />
      </>
    );
  }

  const sales = (data ?? []) as SaleFinancials[];
  const revenue = sales.reduce((s, r) => s + Number(r.total_sale), 0);
  const estimatedCost = sales.reduce((s, r) => s + Number(r.estimated_cost), 0);
  const projectedCost = sales.reduce((s, r) => s + Number(r.projected_cost), 0);
  const projectedMargin = revenue - projectedCost;
  const estimatedMargin = revenue - estimatedCost;
  const marginPct = revenue > 0 ? (projectedMargin / revenue) * 100 : null;
  const estimatedPct = revenue > 0 ? (estimatedMargin / revenue) * 100 : null;

  const atRisk = sales.filter((s) => s.is_low_margin || s.is_cost_overrun);

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        subtitle={`${sales.length} ventas · ${project.name}`}
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Ingresos" value={formatMoney(revenue, currency, { compact: true })} tone="accent" />
        <KpiCard label="Costo estimado" value={formatMoney(estimatedCost, currency, { compact: true })} />
        <KpiCard
          label="Costo proyectado"
          value={formatMoney(projectedCost, currency, { compact: true })}
          hint="real donde existe"
        />
        <KpiCard
          label="Margen"
          value={formatMoney(projectedMargin, currency, { compact: true })}
          hint={`estimado ${formatMoney(estimatedMargin, currency, { compact: true })}`}
          tone={(marginPct ?? 0) < 15 ? 'critical' : 'success'}
        />
        <KpiCard
          label="Margen %"
          value={formatPercent(marginPct)}
          hint={`estimado ${formatPercent(estimatedPct)}`}
          tone={(marginPct ?? 0) < 15 ? 'critical' : (marginPct ?? 0) < 25 ? 'warning' : 'success'}
        />
      </section>

      {atRisk.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>Ventas en riesgo ({atRisk.length})</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {atRisk.map((sale) => (
              <Link
                key={sale.sale_id}
                href={`${base}/ventas/${sale.sale_id}`}
                className="card card-hover p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{sale.sale_number}</span>
                  <StatusBadge status={sale.status} />
                </div>
                <p className="mt-0.5 truncate text-2xs text-content-muted">{sale.client_name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sale.is_low_margin ? (
                    <span className="badge border border-critical/30 bg-critical/15 text-critical">
                      margen {formatPercent(sale.actual_margin_percentage)}
                    </span>
                  ) : null}
                  {sale.is_cost_overrun ? (
                    <span className="badge border border-warning/30 bg-warning/15 text-warning">
                      costo +{formatPercent(sale.cost_deviation_pct)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {sales.length > 0 ? (
        <Card className="mb-6">
          <SectionTitle>Margen estimado vs real por venta</SectionTitle>
          <MarginChart
            data={sales
              .slice(0, 14)
              .reverse()
              .map((s) => ({
                name: s.sale_number.replace(`${project.code}-`, ''),
                estimado: s.estimated_margin,
                real: s.has_actual_cost ? s.actual_margin : null,
              }))}
            currency={currency}
          />
        </Card>
      ) : null}

      <SectionTitle>Detalle por venta</SectionTitle>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Venta</th>
                <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
                <th className="px-4 py-2.5 text-right font-semibold">Venta</th>
                <th className="px-4 py-2.5 text-right font-semibold">Costo est.</th>
                <th className="px-4 py-2.5 text-right font-semibold">Costo real</th>
                <th className="px-4 py-2.5 text-right font-semibold">Margen</th>
                <th className="px-4 py-2.5 text-right font-semibold">%</th>
                <th className="px-4 py-2.5 text-left font-semibold">Costeo</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.sale_id} className="border-b border-line last:border-0 hover:bg-elevated">
                  <td className="px-4 py-2.5">
                    <Link href={`${base}/ventas/${sale.sale_id}`} className="font-medium hover:text-accent">
                      {sale.sale_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-content-secondary">{sale.client_name}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatMoney(sale.total_sale, sale.currency)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-content-secondary">
                    {formatMoney(sale.estimated_cost, sale.currency)}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">
                    {sale.has_actual_cost ? formatMoney(sale.actual_cost, sale.currency) : '—'}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-medium">
                    {formatMoney(sale.projected_margin, sale.currency)}
                  </td>
                  <td
                    className={`tabular px-4 py-2.5 text-right font-medium ${
                      (sale.projected_margin_percentage ?? 0) < 15
                        ? 'text-critical'
                        : (sale.projected_margin_percentage ?? 0) < 25
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {formatPercent(sale.projected_margin_percentage)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-24">
                      <ProgressBar value={sale.cost_recognition_pct ?? 0} showLabel />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-2xs text-content-muted">
        «Costeo» indica que porcentaje del presupuesto ya tiene costo real imputado. Mientras sea
        bajo, el margen mostrado es principalmente estimado.
      </p>
    </>
  );
}
