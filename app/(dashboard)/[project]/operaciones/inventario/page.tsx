import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatMoney, formatNumber, formatPercent, humanize } from '@/lib/format';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { KpiCard } from '@/components/ui/kpi-card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { UsedCourtInventory } from '@/types/database.types';

export const metadata: Metadata = { title: 'Inventario de usadas' };

/** Dashboard de canchas usadas (§48): valor, costo y margen del inventario. */
export default async function UsedInventoryPage({
  params,
}: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;
  const currency = project.default_currency;

  const { data, error } = await supabase
    .from('v_used_courts_inventory')
    .select('*')
    .eq('project_id', project.id)
    .order('court_number');

  if (error) return (<><PageHeader title="Inventario de usadas" /><ErrorState retryHref={`${base}/operaciones/inventario`} /></>);

  const rows = (data ?? []) as UsedCourtInventory[];
  const available = rows.filter((r) => r.status === 'DISPONIBLE');
  const sold = rows.filter((r) => ['VENDIDA', 'ENTREGADA'].includes(r.status));
  const showMargin = can(project, 'profitability.view');

  const inventoryValue = available.reduce((s, r) => s + Number(r.sale_price), 0);
  const inventoryCost = available.reduce((s, r) => s + Number(r.total_cost), 0);
  const soldValue = sold.reduce((s, r) => s + Number(r.sale_price), 0);
  const realMargin = sold.reduce((s, r) => s + Number(r.margin), 0);

  return (
    <>
      <PageHeader title="Inventario de canchas usadas" subtitle={`${rows.length} unidades`} />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Disponibles" value={formatNumber(available.length)} tone="success"
          href={`${base}/operaciones/canchas?status=DISPONIBLE`} />
        <KpiCard label="Reservadas" value={formatNumber(rows.filter((r) => r.status === 'RESERVADA').length)} tone="warning" />
        <KpiCard label="En reparacion" value={formatNumber(rows.filter((r) => r.status === 'EN_REPARACION').length)} />
        <KpiCard label="Vendidas" value={formatNumber(sold.length)} />
        {showMargin ? (
          <>
            <KpiCard label="Valor inventario" value={formatMoney(inventoryValue, currency, { compact: true })}
              hint={`costo ${formatMoney(inventoryCost, currency, { compact: true })}`} tone="accent" />
            <KpiCard label="Margen realizado" value={formatMoney(realMargin, currency, { compact: true })}
              hint={`sobre ${formatMoney(soldValue, currency, { compact: true })} vendidos`} tone="success" />
          </>
        ) : null}
      </section>

      {rows.length === 0 ? (
        <EmptyState title="Inventario vacio" description="No hay canchas usadas registradas en esta unidad de negocio." />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Cancha</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Estado</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Condicion</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Ubicacion</th>
                  {showMargin ? <th className="px-4 py-2.5 text-right font-semibold">Costo total</th> : null}
                  <th className="px-4 py-2.5 text-right font-semibold">Precio</th>
                  {showMargin ? <th className="px-4 py-2.5 text-right font-semibold">Margen</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const marginPct = Number(r.sale_price) > 0 ? (Number(r.margin) / Number(r.sale_price)) * 100 : null;
                  return (
                    <tr key={r.court_id} className="border-b border-line last:border-0 hover:bg-elevated">
                      <td className="px-4 py-2.5">
                        <Link href={`${base}/operaciones/canchas/${r.court_id}`} className="font-medium hover:text-accent">
                          {r.court_number}
                        </Link>
                        <span className="block text-2xs text-content-muted">{r.model ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2.5 text-content-secondary">{humanize(r.physical_condition)}</td>
                      <td className="px-4 py-2.5 text-content-secondary">{r.current_location ?? '—'}</td>
                      {showMargin ? (
                        <td className="tabular px-4 py-2.5 text-right text-content-secondary">
                          {formatMoney(r.total_cost, r.currency)}
                        </td>
                      ) : null}
                      <td className="tabular px-4 py-2.5 text-right">{formatMoney(r.sale_price, r.currency)}</td>
                      {showMargin ? (
                        <td className="tabular px-4 py-2.5 text-right font-medium text-success">
                          {formatMoney(r.margin, r.currency)}
                          <span className="ml-1 text-2xs text-content-muted">{formatPercent(marginPct)}</span>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
