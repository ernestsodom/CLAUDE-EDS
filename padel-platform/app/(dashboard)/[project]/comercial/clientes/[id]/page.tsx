import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Globe, Mail, Pencil, Phone, Star } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatNumber, formatRelative, humanize } from '@/lib/format';
import { Card, DataPoint, EmptyState, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Client360, SaleFinancials } from '@/types/database.types';

export const metadata: Metadata = { title: 'Ficha de cliente' };

/**
 * Ficha de cliente 360 (§75).
 *
 * Todo lo que el negocio sabe del cliente en una pantalla: resumen,
 * contactos, actividad, oportunidades, ventas, canchas y deuda.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;
  const currency = project.default_currency;

  const [summaryRes, clientRes] = await Promise.all([
    supabase.from('v_client_360').select('*').eq('client_id', id).maybeSingle(),
    supabase.from('clients').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
  ]);

  if (!summaryRes.data || !clientRes.data) notFound();
  const summary = summaryRes.data as Client360;
  const client = clientRes.data as {
    company_name: string; legal_name: string | null; tax_id: string | null;
    country: string | null; city: string | null; address: string | null;
    website: string | null; industry: string | null; payment_terms: string | null;
    notes: string | null; created_at: string;
  };

  const [contactsRes, salesRes, opportunitiesRes, activitiesRes, courtsRes] = await Promise.all([
    supabase.from('contacts').select('*').eq('client_id', id).is('deleted_at', null).order('is_primary', { ascending: false }),
    supabase.from('v_sale_financials').select('*').eq('client_id', id).order('sale_date', { ascending: false }).limit(10),
    supabase.from('opportunities').select('id, name, status, estimated_amount, currency, probability, expected_close_date').eq('client_id', id).is('deleted_at', null).order('expected_close_date', { ascending: true }).limit(10),
    supabase.from('commercial_activities').select('id, activity_type, activity_date, subject, result').eq('client_id', id).order('activity_date', { ascending: false }).limit(8),
    supabase.from('courts').select('id, court_number, status, model').eq('client_id', id).is('deleted_at', null).order('court_number').limit(20),
  ]);

  const contacts = (contactsRes.data ?? []) as {
    id: string; first_name: string; last_name: string | null; position: string | null;
    email: string | null; phone: string | null; is_primary: boolean;
  }[];
  const sales = (salesRes.data ?? []) as SaleFinancials[];
  const opportunities = (opportunitiesRes.data ?? []) as {
    id: string; name: string; status: string; estimated_amount: number;
    currency: string; probability: number; expected_close_date: string | null;
  }[];
  const activities = (activitiesRes.data ?? []) as {
    id: string; activity_type: string; activity_date: string; subject: string; result: string | null;
  }[];
  const courts = (courtsRes.data ?? []) as {
    id: string; court_number: string; status: string; model: string | null;
  }[];

  const showFinance = can(project, 'invoices.view');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/comercial/clientes`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Clientes
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {client.company_name}
            <StatusBadge status={summary.status} />
          </span>
        }
        subtitle={[client.city, client.country, client.industry].filter(Boolean).join(' · ') || undefined}
        actions={
          can(project, 'clients.update') ? (
            <Link href={`${base}/comercial/clientes/form/${id}`} className="btn-secondary">
              <Pencil size={14} /> Editar
            </Link>
          ) : null
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <Card>
          <DataPoint label="Vendido" value={formatMoney(summary.total_sold, currency, { compact: true })} />
        </Card>
        <Card>
          <DataPoint label="Pipeline abierto" value={formatMoney(summary.open_pipeline, currency, { compact: true })} />
        </Card>
        {showFinance ? (
          <Card>
            <DataPoint
              label="Por cobrar"
              value={formatMoney(summary.receivable, currency, { compact: true })}
              tone={summary.receivable > 0 ? 'warning' : 'default'}
            />
          </Card>
        ) : null}
        <Card>
          <DataPoint label="Ventas" value={formatNumber(summary.sales_count)} />
        </Card>
        <Card>
          <DataPoint label="Canchas" value={formatNumber(summary.courts_count)} />
        </Card>
        <Card>
          <DataPoint
            label="Seguimientos"
            value={formatNumber(summary.open_follow_ups)}
            hint={summary.overdue_follow_ups > 0 ? `${summary.overdue_follow_ups} vencidos` : 'al dia'}
            tone={summary.overdue_follow_ups > 0 ? 'critical' : 'default'}
          />
        </Card>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Ventas</SectionTitle>
            </div>
            {sales.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin ventas registradas.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {sales.map((sale) => (
                  <li key={sale.sale_id}>
                    <Link
                      href={`${base}/ventas/${sale.sale_id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-elevated"
                    >
                      <span>
                        <span className="text-sm font-medium">{sale.sale_number}</span>
                        <span className="block text-2xs text-content-muted">
                          {formatDate(sale.sale_date)} · {sale.courts_total} canchas
                        </span>
                      </span>
                      <StatusBadge status={sale.status} />
                      <span className="tabular text-sm font-medium">
                        {formatMoney(sale.total_sale, sale.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4">
              <SectionTitle>Oportunidades</SectionTitle>
            </div>
            {opportunities.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin oportunidades abiertas.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {opportunities.map((opp) => (
                  <li key={opp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{opp.name}</span>
                      <span className="text-2xs text-content-muted">
                        cierre {formatDate(opp.expected_close_date)} · {opp.probability}%
                      </span>
                    </span>
                    <StatusBadge status={opp.status} />
                    <span className="tabular text-sm">
                      {formatMoney(opp.estimated_amount, opp.currency as never)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>Actividad comercial</SectionTitle>
            {activities.length === 0 ? (
              <EmptyState title="Sin actividad" description="No se han registrado interacciones con este cliente." />
            ) : (
              <ul className="divide-y divide-line">
                {activities.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm">{a.subject}</p>
                      <time className="shrink-0 text-2xs text-content-muted">
                        {formatRelative(a.activity_date)}
                      </time>
                    </div>
                    <p className="text-2xs text-content-muted">
                      {humanize(a.activity_type)}
                      {a.result ? ` · ${a.result}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle>Datos fiscales</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Razon social">{client.legal_name ?? client.company_name}</Field>
              <Field label="CIF / NIF">{client.tax_id ?? '—'}</Field>
              <Field label="Direccion">{client.address ?? '—'}</Field>
              <Field label="Ciudad">{client.city ?? '—'}</Field>
              <Field label="Pais">{client.country ?? '—'}</Field>
              <Field label="Forma de pago">{client.payment_terms ?? '—'}</Field>
            </dl>
            {client.website ? (
              <a
                href={`https://${client.website.replace(/^https?:\/\//, '')}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-flex items-center gap-1.5 text-2xs text-accent hover:underline"
              >
                <Globe size={12} />
                {client.website}
              </a>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Contactos ({contacts.length})</SectionTitle>
            {contacts.length === 0 ? (
              <p className="text-sm text-content-muted">Sin contactos registrados.</p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((contact) => (
                  <li key={contact.id} className="rounded border border-line p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {contact.first_name} {contact.last_name ?? ''}
                      {contact.is_primary ? (
                        <Star size={11} className="fill-accent text-accent" aria-label="Contacto principal" />
                      ) : null}
                    </p>
                    {contact.position ? (
                      <p className="text-2xs text-content-muted">{contact.position}</p>
                    ) : null}
                    <div className="mt-1.5 space-y-0.5">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-2xs text-content-secondary hover:text-accent">
                          <Mail size={11} /> {contact.email}
                        </a>
                      ) : null}
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-2xs text-content-secondary hover:text-accent">
                          <Phone size={11} /> {contact.phone}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {courts.length > 0 ? (
            <Card>
              <SectionTitle>Canchas ({courts.length})</SectionTitle>
              <ul className="space-y-1">
                {courts.map((court) => (
                  <li key={court.id}>
                    <Link
                      href={`${base}/operaciones/canchas/${court.id}`}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-elevated"
                    >
                      <span>{court.court_number}</span>
                      <StatusBadge status={court.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
