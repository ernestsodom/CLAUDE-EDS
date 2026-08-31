import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney } from '@/lib/format';
import { Card, ErrorState, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { DealCourts } from '@/components/deals/deal-courts';
import { isClosedStatus } from '@/lib/validations/deals';
import type {
  CourtModel, Deal, DealCourt, DealCourtLogo, LogoPosition,
} from '@/types/database.types';

export const metadata: Metadata = { title: 'Negocio' };

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  if (!can(project, 'deals.view')) {
    return (
      <>
        <PageHeader title="Negocio" />
        <ErrorState title="Sin acceso" description="Tu rol no permite ver los negocios de este proyecto." />
      </>
    );
  }

  const supabase = await createClient();
  const [dealRes, courtsRes, modelsRes, positionsRes] = await Promise.all([
    supabase.from('deals').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('deal_courts').select('*').eq('deal_id', id).order('position'),
    supabase.from('court_models').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('logo_positions').select('*').eq('project_id', project.id).eq('active', true).order('sort_order'),
  ]);

  const deal = dealRes.data as Deal | null;
  if (!deal) notFound();

  const courts = (courtsRes.data ?? []) as DealCourt[];
  const models = (modelsRes.data ?? []) as CourtModel[];
  const positions = (positionsRes.data ?? []) as LogoPosition[];

  // Solo los logos de las canchas de ESTE negocio: pedir los del proyecto
  // entero y filtrarlos en el servidor seria traer datos para tirarlos.
  const courtIds = courts.map((c) => c.id);
  const logosRes = courtIds.length
    ? await supabase
        .from('deal_court_logos')
        .select('id, deal_court_id, brand, logo_position_id')
        .in('deal_court_id', courtIds)
    : { data: [] };
  const logos = (logosRes.data ?? []) as DealCourtLogo[];

  const closed = isClosedStatus(deal.status);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/negocios`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Negocios
          </Link>
        }
        title={deal.client_name}
        subtitle={`${deal.code} · ${[deal.city, deal.country].filter(Boolean).join(', ') || 'sin ubicacion'}`}
        actions={
          can(project, 'deals.update') ? (
            <Link href={`${base}/negocios/form/${deal.id}`} className="btn-secondary">
              <Pencil size={15} />
              Editar
            </Link>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Estado del negocio</SectionTitle>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Estado">
              <StatusBadge status={deal.status} />
            </Field>
            <Field label="Canchas">
              <span className="tabular">{deal.courts_count}</span>
            </Field>
            <Field label="Comision total">
              <span className="tabular font-medium">
                {formatMoney(deal.total_commission_usd, 'USD')}
              </span>
            </Field>
            <Field label="Comision por cancha">
              <span className="tabular">{formatMoney(deal.commission_per_court_usd, 'USD')}</span>
            </Field>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Fechas</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Alta">{formatDate(deal.opened_at)}</Field>
            <Field label="Cierre estimado">
              {deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}
            </Field>
            <Field label="Cierre real">{deal.closed_at ? formatDate(deal.closed_at) : '—'}</Field>
            <Field label="Entrega">{deal.delivery_date ? formatDate(deal.delivery_date) : '—'}</Field>
          </dl>
          {!closed ? (
            <p className="mt-3 text-2xs leading-relaxed text-content-muted">
              La fecha de entrega solo se registra cuando la venta esta cerrada. Mientras el
              negocio siga abierto, este campo permanece vacio a proposito.
            </p>
          ) : null}
        </Card>

        {deal.contact_name || deal.contact_email || deal.contact_phone || deal.notes || deal.lost_reason ? (
          <Card className="lg:col-span-3">
            <SectionTitle>Contacto y notas</SectionTitle>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Contacto">{deal.contact_name ?? '—'}</Field>
              <Field label="Email">{deal.contact_email ?? '—'}</Field>
              <Field label="Telefono">{deal.contact_phone ?? '—'}</Field>
              {deal.status === 'PERDIDA' ? (
                <Field label="Motivo de perdida">{deal.lost_reason ?? '—'}</Field>
              ) : null}
            </dl>
            {deal.notes ? (
              <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm text-content-secondary">
                {deal.notes}
              </p>
            ) : null}
          </Card>
        ) : null}

        <div className="lg:col-span-3">
          <DealCourts
            projectCode={project.code}
            dealId={deal.id}
            courts={courts}
            models={models}
            positions={positions}
            logos={logos}
            defaultCommission={deal.commission_per_court_usd}
            editable={can(project, 'deals.update')}
            deletable={can(project, 'deals.delete')}
            total={deal.total_commission_usd}
          />
        </div>
      </div>
    </>
  );
}
