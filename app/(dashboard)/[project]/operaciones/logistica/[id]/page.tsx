import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { Card, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Embarque' };

export default async function ShipmentDetailPage({
  params,
}: { params: Promise<{ project: string; id: string }> }) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data } = await supabase
    .from('shipments').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) notFound();

  const s = data as unknown as {
    shipment_number: string; status: string; customs_status: string; transport_mode: string;
    origin: string | null; origin_country: string | null; destination: string | null;
    destination_country: string | null; carrier: string | null; forwarder: string | null;
    container_number: string | null; container_type: string | null; booking_number: string | null;
    bl_number: string | null; incoterm: string | null; departure_date: string | null;
    estimated_arrival: string | null; actual_arrival: string | null; customs_cleared_at: string | null;
    freight_cost: number | null; insurance_cost: number | null; customs_cost: number | null;
    currency: 'EUR' | 'USD' | 'ARS' | 'CLP'; sale_id: string | null; notes: string | null;
  };

  const { data: itemsData } = await supabase
    .from('shipment_items')
    .select('id, packages, gross_weight_kg, volume_m3, courts(id, court_number, status, model)')
    .eq('shipment_id', id);

  const items = (itemsData ?? []) as unknown as {
    id: string; packages: number | null; gross_weight_kg: number | null; volume_m3: number | null;
    courts: { id: string; court_number: string; status: string; model: string | null } | null;
  }[];

  const totalCost = (s.freight_cost ?? 0) + (s.insurance_cost ?? 0) + (s.customs_cost ?? 0);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/operaciones/logistica`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Logistica
          </Link>
        }
        title={<span className="flex items-center gap-3">{s.shipment_number}<StatusBadge status={s.status} /></span>}
        subtitle={`${s.origin ?? '—'} → ${s.destination ?? '—'} · ${humanize(s.transport_mode)}`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle>Documentacion de transporte</SectionTitle>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Transportista">{s.carrier ?? '—'}</Field>
              <Field label="Forwarder">{s.forwarder ?? '—'}</Field>
              <Field label="Incoterm">{s.incoterm ?? '—'}</Field>
              <Field label="Contenedor">{s.container_number ?? '—'}</Field>
              <Field label="Tipo">{s.container_type ?? '—'}</Field>
              <Field label="Booking">{s.booking_number ?? '—'}</Field>
              <Field label="BL">{s.bl_number ?? '—'}</Field>
              <Field label="Aduana"><StatusBadge status={s.customs_status} /></Field>
              <Field label="Liberado">{formatDate(s.customs_cleared_at)}</Field>
            </dl>
          </Card>

          <Card>
            <SectionTitle>Fechas</SectionTitle>
            <dl className="grid grid-cols-3 gap-4">
              <Field label="Salida">{formatDate(s.departure_date)}</Field>
              <Field label="ETA">{formatDate(s.estimated_arrival)}</Field>
              <Field label="Llegada real">{formatDate(s.actual_arrival)}</Field>
            </dl>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4"><SectionTitle>Canchas embarcadas ({items.length})</SectionTitle></div>
            {items.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin canchas asignadas a este embarque.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.courts ? (
                      <Link
                        href={`${base}/operaciones/canchas/${item.courts.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-elevated"
                      >
                        <span>
                          <span className="text-sm font-medium">{item.courts.court_number}</span>
                          <span className="ml-2 text-2xs text-content-muted">{item.courts.model ?? ''}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-2xs text-content-muted">
                            {item.packages ?? '—'} bultos · {item.gross_weight_kg ?? '—'} kg
                          </span>
                          <StatusBadge status={item.courts.status} />
                        </span>
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle>Costos logisticos</SectionTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-content-secondary">Flete</dt><dd className="tabular">{formatMoney(s.freight_cost, s.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-content-secondary">Seguro</dt><dd className="tabular">{formatMoney(s.insurance_cost, s.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-content-secondary">Aduana</dt><dd className="tabular">{formatMoney(s.customs_cost, s.currency)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt>Total</dt><dd className="tabular">{formatMoney(totalCost, s.currency)}</dd>
              </div>
            </dl>
          </Card>

          {s.sale_id ? (
            <Card>
              <SectionTitle>Venta</SectionTitle>
              <Link href={`${base}/ventas/${s.sale_id}`} className="text-sm text-accent hover:underline">
                Ver ficha de venta →
              </Link>
            </Card>
          ) : null}

          {s.notes ? (
            <Card>
              <SectionTitle>Notas</SectionTitle>
              <p className="text-sm text-content-secondary">{s.notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
