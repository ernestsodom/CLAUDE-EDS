import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, FileText, Package, TriangleAlert } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatNumber, formatPercent, humanize } from '@/lib/format';
import { Card, DataPoint, Field, PageHeader, ProgressBar, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmSaleButton } from '@/components/commercial/confirm-sale-button';
import { CostVarianceTable } from '@/components/finance/cost-variance-table';
import { Timeline } from '@/components/shared/timeline';
import { ChecklistPanel } from '@/components/operations/checklist-panel';
import type {
  ChecklistItem, Court, ProjectEvent, SaleCostVariance, SaleFinancials, SaleItem,
} from '@/types/database.types';

export const metadata: Metadata = { title: 'Ficha de venta' };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data: sale } = await supabase
    .from('v_sale_financials')
    .select('*')
    .eq('sale_id', id)
    .maybeSingle();

  if (!sale) notFound();
  const s = sale as SaleFinancials;
  const showMargin = can(project, 'profitability.view');
  const showFinance = can(project, 'invoices.view');

  const [itemsRes, courtsRes, varianceRes, eventsRes, checklistRes, invoicesRes, manufacturingRes] =
    await Promise.all([
      supabase.from('sale_items').select('*').eq('sale_id', id).order('sort_order'),
      supabase
        .from('courts')
        .select('*')
        .eq('sale_id', id)
        .is('deleted_at', null)
        .order('court_number'),
      showMargin
        ? supabase.from('v_sale_cost_variance').select('*').eq('sale_id', id)
        : Promise.resolve({ data: [] }),
      supabase
        .from('project_events')
        .select('*')
        .eq('entity_type', 'SALE')
        .eq('entity_id', id)
        .order('event_date', { ascending: false })
        .limit(25),
      supabase
        .from('project_checklists')
        .select('id, name, checklist_items(*)')
        .eq('entity_type', 'SALE')
        .eq('entity_id', id)
        .maybeSingle(),
      showFinance
        ? supabase
            .from('invoices')
            .select('id, invoice_number, invoice_date, due_date, total, paid_amount, balance, status, currency')
            .eq('sale_id', id)
            .is('deleted_at', null)
            .order('invoice_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('v_manufacturing_summary')
        .select('*')
        .eq('sale_id', id)
        .maybeSingle(),
    ]);

  const items = (itemsRes.data ?? []) as SaleItem[];
  const courts = (courtsRes.data ?? []) as Court[];
  const variance = (varianceRes.data ?? []) as SaleCostVariance[];
  const events = (eventsRes.data ?? []) as ProjectEvent[];
  const invoices = (invoicesRes.data ?? []) as {
    id: string; invoice_number: string; invoice_date: string; due_date: string | null;
    total: number; paid_amount: number; balance: number; status: string; currency: string;
  }[];
  const manufacturing = manufacturingRes.data as
    | { manufacturing_project_id: string; progress_pct: number | null; status: string; is_delayed: boolean }
    | null;
  const checklist = checklistRes.data as
    | { id: string; name: string; checklist_items: ChecklistItem[] }
    | null;

  const canConfirm =
    can(project, 'sales.approve') &&
    ['BORRADOR', 'COTIZACION', 'COMPROMETIDA'].includes(s.status);

  // Avance por fase, derivado de hechos reales (no de un campo manual)
  const deliveryPct = s.courts_total > 0 ? (s.courts_delivered / s.courts_total) * 100 : 0;
  const logisticsPct =
    s.courts_total > 0
      ? ((s.courts_in_transit + s.courts_installing + s.courts_delivered) / s.courts_total) * 100
      : 0;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/ventas`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Ventas
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {s.sale_number}
            <StatusBadge status={s.status} />
            {s.delivery_state === 'PARCIALMENTE_ENTREGADA' ? (
              <StatusBadge status="PARCIALMENTE_ENTREGADA" tone="warning" />
            ) : null}
          </span>
        }
        subtitle={
          <Link
            href={`${base}/comercial/clientes/${s.client_id}`}
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            <Building2 size={13} />
            {s.client_name}
            {s.client_country ? ` · ${s.client_country}` : ''}
          </Link>
        }
        actions={
          canConfirm ? <ConfirmSaleButton projectCode={project.code} saleId={s.sale_id} /> : null
        }
      />

      {/* Alertas de negocio inline: el problema se ve donde se decide */}
      {(s.is_low_margin || s.is_cost_overrun) && showMargin ? (
        <div className="mb-5 flex flex-wrap gap-3">
          {s.is_low_margin ? (
            <div className="flex items-center gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
              <TriangleAlert size={15} />
              Margen bajo: {formatPercent(s.actual_margin_percentage)}
            </div>
          ) : null}
          {s.is_cost_overrun ? (
            <div className="flex items-center gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlert size={15} />
              Costo {formatPercent(s.cost_deviation_pct)} sobre lo presupuestado
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Cifras de cabecera ---- */}
      <section className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Card>
          <DataPoint label="Valor de venta" value={formatMoney(s.total_sale, s.currency)} />
        </Card>
        <Card>
          <DataPoint
            label="Canchas"
            value={formatNumber(s.courts_total)}
            hint={`${s.courts_delivered} entregadas`}
          />
        </Card>
        {showFinance ? (
          <>
            <Card>
              <DataPoint
                label="Cobrado"
                value={formatMoney(s.collected_amount, s.currency)}
                hint={formatPercent(s.collection_percentage)}
                tone="success"
              />
            </Card>
            <Card>
              <DataPoint
                label="Por cobrar"
                value={formatMoney(s.receivable_amount, s.currency)}
                tone={s.receivable_amount > 0 ? 'warning' : 'default'}
              />
            </Card>
          </>
        ) : null}
        {showMargin ? (
          <>
            <Card>
              <DataPoint
                label="Costo"
                value={formatMoney(s.projected_cost, s.currency)}
                hint={
                  s.has_actual_cost
                    ? `real · ${formatPercent(s.cost_recognition_pct)} imputado`
                    : 'estimado'
                }
              />
            </Card>
            <Card>
              <DataPoint
                label={s.has_actual_cost ? 'Margen real' : 'Margen estimado'}
                value={formatMoney(s.projected_margin, s.currency)}
                hint={formatPercent(s.projected_margin_percentage)}
                tone={
                  (s.projected_margin_percentage ?? 0) < 15
                    ? 'critical'
                    : (s.projected_margin_percentage ?? 0) < 25
                      ? 'warning'
                      : 'success'
                }
              />
            </Card>
          </>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ---- Avance operacional ---- */}
          <Card>
            <SectionTitle>Avance</SectionTitle>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-content-secondary">Fabricacion</span>
                  <span className="tabular text-content-muted">
                    {manufacturing ? formatPercent(manufacturing.progress_pct, 0) : 'sin proyecto'}
                  </span>
                </div>
                <ProgressBar
                  value={manufacturing?.progress_pct ?? 0}
                  tone={manufacturing?.is_delayed ? 'critical' : 'accent'}
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-content-secondary">Logistica</span>
                  <span className="tabular text-content-muted">{formatPercent(logisticsPct, 0)}</span>
                </div>
                <ProgressBar value={logisticsPct} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-content-secondary">Entrega</span>
                  <span className="tabular text-content-muted">
                    {s.courts_delivered}/{s.courts_total}
                  </span>
                </div>
                <ProgressBar value={deliveryPct} tone={deliveryPct === 100 ? 'success' : 'accent'} />
              </div>
            </div>

            {manufacturing ? (
              <Link
                href={`${base}/operaciones/fabricacion/${manufacturing.manufacturing_project_id}`}
                className="mt-4 inline-block text-2xs text-accent hover:underline"
              >
                Ver proyecto de fabricacion →
              </Link>
            ) : null}
          </Card>

          {/* ---- Lineas de la venta ---- */}
          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Detalle de la venta</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                    <th className="px-4 py-2 text-left font-semibold">Concepto</th>
                    <th className="px-4 py-2 text-right font-semibold">Cant.</th>
                    <th className="px-4 py-2 text-right font-semibold">Precio</th>
                    <th className="px-4 py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <p>{item.description}</p>
                        <p className="text-2xs text-content-muted">
                          {humanize(item.product_type)}
                          {item.model ? ` · ${item.model}` : ''}
                        </p>
                      </td>
                      <td className="tabular px-4 py-2.5 text-right">{formatNumber(item.quantity)}</td>
                      <td className="tabular px-4 py-2.5 text-right">
                        {formatMoney(item.unit_price, s.currency)}
                      </td>
                      <td className="tabular px-4 py-2.5 text-right font-medium">
                        {formatMoney(item.subtotal, s.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs text-content-muted">
                      Total
                    </td>
                    <td className="tabular px-4 py-3 text-right text-base font-semibold">
                      {formatMoney(s.total_sale, s.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* ---- Costos: presupuesto vs real (§52, §54) ---- */}
          {showMargin ? (
            <Card padded={false}>
              <div className="px-4 pt-4">
                <SectionTitle>Costos: presupuesto vs real</SectionTitle>
              </div>
              <CostVarianceTable
                rows={variance}
                currency={s.currency}
                thresholdPct={10}
              />
            </Card>
          ) : null}

          {/* ---- Canchas de esta venta ---- */}
          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Canchas ({courts.length})</SectionTitle>
            </div>
            {courts.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">
                Aun no se han generado canchas. Se crean al confirmar la venta.
              </p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {courts.map((court) => (
                  <li key={court.id}>
                    <Link
                      href={`${base}/operaciones/canchas/${court.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-elevated"
                    >
                      <span className="flex items-center gap-2.5">
                        <Package size={14} className="text-content-muted" />
                        <span className="text-sm font-medium">{court.court_number}</span>
                        <span className="text-2xs text-content-muted">{court.model ?? '—'}</span>
                      </span>
                      <StatusBadge status={court.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Facturacion ---- */}
          {showFinance ? (
            <Card padded={false}>
              <div className="px-4 pt-4">
                <SectionTitle>Facturas</SectionTitle>
              </div>
              {invoices.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-content-muted">
                  Sin facturas emitidas para esta venta.
                </p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileText size={14} className="text-content-muted" />
                        <span className="text-sm">{inv.invoice_number}</span>
                        <StatusBadge status={inv.status} />
                      </span>
                      <span className="flex items-center gap-4 text-sm">
                        <span className="tabular">{formatMoney(inv.total, s.currency)}</span>
                        <span className="tabular text-content-muted">
                          saldo {formatMoney(inv.balance, s.currency)}
                        </span>
                        <span className="text-2xs text-content-muted">
                          vence {formatDate(inv.due_date)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* ---- Columna lateral ---- */}
        <div className="space-y-5">
          <Card>
            <SectionTitle>Datos</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Fecha de venta">{formatDate(s.sale_date)}</Field>
              <Field label="Entrega prevista">{formatDate(s.delivery_date)}</Field>
              <Field label="Moneda">{s.currency}</Field>
              <Field label="Estado de entrega">{humanize(s.delivery_state)}</Field>
              <Field label="Pais">{s.client_country ?? '—'}</Field>
              <Field label="Facturado">{formatMoney(s.invoiced_amount, s.currency)}</Field>
            </dl>
          </Card>

          {checklist ? (
            <ChecklistPanel
              projectCode={project.code}
              title={checklist.name}
              items={checklist.checklist_items ?? []}
              revalidatePath={`${base}/ventas/${id}`}
              editable={can(project, 'manufacturing.update')}
            />
          ) : null}

          <Card>
            <SectionTitle>Historial</SectionTitle>
            <Timeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}
