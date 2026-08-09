import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/format';
import { Card, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { ChecklistPanel } from '@/components/operations/checklist-panel';
import type { ChecklistItem } from '@/types/database.types';

export const metadata: Metadata = { title: 'Instalacion' };

export default async function InstallationDetailPage({
  params,
}: { params: Promise<{ project: string; id: string }> }) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data } = await supabase
    .from('installations')
    .select('*, clients(company_name)')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) notFound();

  const i = data as unknown as {
    installation_number: string; name: string | null; address: string | null;
    city: string | null; country: string | null; status: string;
    planned_start_date: string | null; planned_end_date: string | null;
    actual_start_date: string | null; actual_end_date: string | null;
    received_at: string | null; received_by_name: string | null;
    client_observations: string | null; sale_id: string | null;
    crew: { name?: string; role?: string }[];
    clients: { company_name: string } | null;
  };

  const [courtsRes, checklistRes] = await Promise.all([
    supabase.from('installation_courts').select('id, installed_at, courts(id, court_number, status)').eq('installation_id', id),
    supabase.from('project_checklists').select('id, name, checklist_items(*)')
      .eq('entity_type', 'INSTALLATION').eq('entity_id', id).maybeSingle(),
  ]);

  const courts = (courtsRes.data ?? []) as unknown as {
    id: string; installed_at: string | null;
    courts: { id: string; court_number: string; status: string } | null;
  }[];
  const checklist = checklistRes.data as { id: string; name: string; checklist_items: ChecklistItem[] } | null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/operaciones/instalaciones`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Instalaciones
          </Link>
        }
        title={<span className="flex items-center gap-3">{i.installation_number}<StatusBadge status={i.status} /></span>}
        subtitle={
          <span className="flex items-center gap-1.5">
            {i.clients?.company_name}
            <span className="text-content-muted">·</span>
            <MapPin size={12} />
            {[i.address, i.city, i.country].filter(Boolean).join(', ')}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle>Planificacion</SectionTitle>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Inicio previsto">{formatDate(i.planned_start_date)}</Field>
              <Field label="Fin previsto">{formatDate(i.planned_end_date)}</Field>
              <Field label="Inicio real">{formatDate(i.actual_start_date)}</Field>
              <Field label="Fin real">{formatDate(i.actual_end_date)}</Field>
            </dl>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4"><SectionTitle>Canchas ({courts.length})</SectionTitle></div>
            {courts.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin canchas asignadas.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {courts.map((c) => c.courts ? (
                  <li key={c.id}>
                    <Link href={`${base}/operaciones/canchas/${c.courts.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-elevated">
                      <span className="text-sm font-medium">{c.courts.court_number}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-2xs text-content-muted">{formatDate(c.installed_at)}</span>
                        <StatusBadge status={c.courts.status} />
                      </span>
                    </Link>
                  </li>
                ) : null)}
              </ul>
            )}
          </Card>

          {i.status === 'RECEPCIONADA' || i.received_at ? (
            <Card>
              <SectionTitle>Acta de entrega</SectionTitle>
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Recepcionada">{formatDate(i.received_at, 'datetime')}</Field>
                <Field label="Recibido por">{i.received_by_name ?? '—'}</Field>
              </dl>
              {i.client_observations ? (
                <p className="mt-3 text-sm text-content-secondary">{i.client_observations}</p>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {checklist ? (
            <ChecklistPanel
              projectCode={project.code}
              title={checklist.name}
              items={checklist.checklist_items ?? []}
              revalidatePath={`${base}/operaciones/instalaciones/${id}`}
              editable={can(project, 'manufacturing.update')}
            />
          ) : null}

          <Card>
            <SectionTitle>Equipo</SectionTitle>
            {Array.isArray(i.crew) && i.crew.length > 0 ? (
              <ul className="space-y-1.5">
                {i.crew.map((member, index) => (
                  <li key={index} className="text-sm">
                    {member.name}
                    {member.role ? <span className="ml-1.5 text-2xs text-content-muted">{member.role}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-content-muted">Sin equipo asignado.</p>
            )}
          </Card>

          {i.sale_id ? (
            <Card>
              <SectionTitle>Venta</SectionTitle>
              <Link href={`${base}/ventas/${i.sale_id}`} className="text-sm text-accent hover:underline">
                Ver ficha de venta →
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
