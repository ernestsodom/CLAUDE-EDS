import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Pencil } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatRelative, humanize } from '@/lib/format';
import { Card, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { CourtStatusControl } from '@/components/operations/court-status-control';
import { CourtLifecycle } from '@/components/operations/court-lifecycle';
import { Timeline } from '@/components/shared/timeline';
import type { Court, CourtStatusHistory, ProjectEvent } from '@/types/database.types';

export const metadata: Metadata = { title: 'Ficha de cancha' };

export default async function CourtDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data: court } = await supabase
    .from('courts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!court) notFound();
  const c = court as Court;

  const [historyRes, eventsRes, saleRes, shipmentRes] = await Promise.all([
    supabase
      .from('court_status_history')
      .select('*')
      .eq('court_id', id)
      .order('changed_at', { ascending: false }),
    supabase
      .from('project_events')
      .select('*')
      .eq('entity_type', 'COURT')
      .eq('entity_id', id)
      .order('event_date', { ascending: false })
      .limit(20),
    c.sale_id
      ? supabase
          .from('v_sale_financials')
          .select('sale_id, sale_number, client_name, client_id, currency, total_sale')
          .eq('sale_id', c.sale_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('shipment_items')
      .select('shipment_id, shipments(shipment_number, status, estimated_arrival, destination)')
      .eq('court_id', id)
      .maybeSingle(),
  ]);

  const history = (historyRes.data ?? []) as CourtStatusHistory[];
  const events = (eventsRes.data ?? []) as ProjectEvent[];
  const sale = saleRes.data as
    | { sale_id: string; sale_number: string; client_name: string; client_id: string; currency: string; total_sale: number }
    | null;
  const shipment = shipmentRes.data as
    | {
        shipment_id: string;
        shipments: { shipment_number: string; status: string; estimated_arrival: string | null; destination: string | null } | null;
      }
    | null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/operaciones/canchas`}
            className="inline-flex items-center gap-1 hover:text-accent"
          >
            <ArrowLeft size={12} /> Canchas
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {c.court_number}
            <StatusBadge status={c.status} />
          </span>
        }
        subtitle={
          <span className="flex items-center gap-1.5">
            {c.model ?? 'Modelo sin especificar'}
            {c.current_location ? (
              <>
                <span className="text-content-muted">·</span>
                <MapPin size={12} />
                {c.current_location}
              </>
            ) : null}
          </span>
        }
        actions={
          can(project, 'courts.update') ? (
            <div className="flex gap-2">
              <Link href={`${base}/operaciones/canchas/form/${c.id}`} className="btn-secondary">
                <Pencil size={14} /> Editar
              </Link>
              <CourtStatusControl
                projectCode={project.code}
                courtId={c.id}
                currentStatus={c.status}
                courtType={c.court_type}
              />
            </div>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ---- Ciclo de vida (§74) ---- */}
          <Card>
            <SectionTitle>Ciclo de vida</SectionTitle>
            <CourtLifecycle
              courtType={c.court_type}
              currentStatus={c.status}
              history={history}
            />
          </Card>

          <Card>
            <SectionTitle>Ficha tecnica</SectionTitle>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Numero de serie">{c.serial_number ?? '—'}</Field>
              <Field label="Modelo">{c.model ?? '—'}</Field>
              <Field label="Tipo">{humanize(c.court_type)}</Field>
              <Field label="Ano">{c.year ?? '—'}</Field>
              <Field label="Condicion">{humanize(c.physical_condition)}</Field>
              <Field label="Iluminacion">{c.has_lighting ? 'Si' : 'No'}</Field>
              <Field label="Pais">{c.country ?? '—'}</Field>
              <Field label="Ciudad">{c.city ?? '—'}</Field>
              <Field label="Entregada">{formatDate(c.delivered_at)}</Field>
            </dl>
          </Card>

          {c.court_type === 'USADA' && can(project, 'profitability.view') ? (
            <Card>
              <SectionTitle>Economia de la unidad</SectionTitle>
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Costo de compra">{formatMoney(c.purchase_cost, c.currency)}</Field>
                <Field label="Reacondicionamiento">
                  {formatMoney(c.refurbishment_cost, c.currency)}
                </Field>
                <Field label="Precio de venta">{formatMoney(c.sale_price, c.currency)}</Field>
                <Field label="Margen bruto">
                  {formatMoney(
                    (c.sale_price ?? 0) - (c.purchase_cost ?? 0) - (c.refurbishment_cost ?? 0),
                    c.currency,
                  )}
                </Field>
              </dl>
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Historial de estados</SectionTitle>
            {history.length === 0 ? (
              <p className="text-sm text-content-muted">Sin cambios registrados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 text-sm">
                      {h.previous_status ? (
                        <>
                          <span className="text-content-muted">{humanize(h.previous_status)}</span>
                          <span className="text-content-muted">→</span>
                        </>
                      ) : (
                        <span className="text-content-muted">Alta</span>
                      )}
                      <StatusBadge status={h.new_status} />
                    </span>
                    <span className="text-2xs text-content-muted" title={formatDate(h.changed_at, 'datetime')}>
                      {formatRelative(h.changed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {sale ? (
            <Card>
              <SectionTitle>Venta asociada</SectionTitle>
              <Link
                href={`${base}/ventas/${sale.sale_id}`}
                className="block rounded border border-line p-3 transition-colors hover:border-line-strong hover:bg-elevated"
              >
                <p className="text-sm font-medium">{sale.sale_number}</p>
                <p className="text-2xs text-content-muted">{sale.client_name}</p>
                <p className="tabular mt-1 text-sm">
                  {formatMoney(sale.total_sale, sale.currency as never)}
                </p>
              </Link>
            </Card>
          ) : null}

          {shipment?.shipments ? (
            <Card>
              <SectionTitle>Embarque</SectionTitle>
              <Link
                href={`${base}/operaciones/logistica/${shipment.shipment_id}`}
                className="block rounded border border-line p-3 transition-colors hover:border-line-strong hover:bg-elevated"
              >
                <p className="text-sm font-medium">{shipment.shipments.shipment_number}</p>
                <StatusBadge status={shipment.shipments.status} className="mt-1" />
                <p className="mt-2 text-2xs text-content-muted">
                  Destino: {shipment.shipments.destination ?? '—'}
                </p>
                <p className="text-2xs text-content-muted">
                  ETA: {formatDate(shipment.shipments.estimated_arrival)}
                </p>
              </Link>
            </Card>
          ) : null}

          <Card>
            <SectionTitle>Actividad</SectionTitle>
            <Timeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}
