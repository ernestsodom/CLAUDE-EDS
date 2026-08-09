import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { Card, Field, PageHeader, ProgressBar, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { ChecklistPanel } from '@/components/operations/checklist-panel';
import type { ChecklistItem, Court, ManufacturingSummary } from '@/types/database.types';

export const metadata: Metadata = { title: 'Proyecto de fabricacion' };

export default async function ManufacturingDetailPage({
  params,
}: { params: Promise<{ project: string; id: string }> }) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data } = await supabase
    .from('v_manufacturing_summary').select('*').eq('manufacturing_project_id', id).maybeSingle();
  if (!data) notFound();
  const mp = data as ManufacturingSummary;

  const [courtsRes, materialsRes, checklistRes] = await Promise.all([
    supabase.from('courts').select('*').eq('manufacturing_project_id', id).is('deleted_at', null).order('court_number'),
    supabase.from('material_requirements')
      .select('id, quantity_required, quantity_available, quantity_purchased, quantity_missing, needed_by_date, materials(code, name, unit)')
      .eq('manufacturing_project_id', id),
    supabase.from('project_checklists').select('id, name, checklist_items(*)')
      .eq('entity_type', 'MANUFACTURING_PROJECT').eq('entity_id', id).maybeSingle(),
  ]);

  const courts = (courtsRes.data ?? []) as Court[];
  const materials = (materialsRes.data ?? []) as unknown as {
    id: string; quantity_required: number; quantity_missing: number; needed_by_date: string | null;
    materials: { code: string; name: string; unit: string } | null;
  }[];
  const checklist = checklistRes.data as { id: string; name: string; checklist_items: ChecklistItem[] } | null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/operaciones/fabricacion`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Fabricacion
          </Link>
        }
        title={<span className="flex items-center gap-3">{mp.name}<StatusBadge status={mp.status} /></span>}
        subtitle={mp.is_delayed ? `Atrasado · entrega estimada ${formatDate(mp.estimated_completion_date)}` : undefined}
        actions={
          can(project, 'manufacturing.update') ? (
            <Link href={`${base}/operaciones/fabricacion/form/${id}`} className="btn-secondary">
              <Pencil size={14} /> Editar
            </Link>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle>Avance</SectionTitle>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-content-secondary">{mp.courts_built}/{mp.courts_count} canchas construidas</span>
              <span className="tabular text-content-muted">{formatPercent(mp.progress_pct, 0)}</span>
            </div>
            <ProgressBar value={mp.progress_pct} tone={mp.is_delayed ? 'critical' : 'accent'} />

            <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Inicio">{formatDate(mp.start_date)}</Field>
              <Field label="Entrega estimada">{formatDate(mp.estimated_completion_date)}</Field>
              <Field label="Entrega real">{formatDate(mp.actual_completion_date)}</Field>
              <Field label="Dias al plazo">
                {mp.days_to_deadline === null ? '—' : `${mp.days_to_deadline}`}
              </Field>
            </dl>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4"><SectionTitle>Canchas ({courts.length})</SectionTitle></div>
            <ul className="divide-y divide-line border-t border-line">
              {courts.map((court) => (
                <li key={court.id}>
                  <Link href={`${base}/operaciones/canchas/${court.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-elevated">
                    <span className="text-sm font-medium">{court.court_number}</span>
                    <StatusBadge status={court.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card padded={false}>
            <div className="px-4 pt-4"><SectionTitle>Materiales</SectionTitle></div>
            {materials.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-content-muted">Sin requerimientos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                    <th className="px-4 py-2 text-left font-semibold">Material</th>
                    <th className="px-4 py-2 text-right font-semibold">Requerido</th>
                    <th className="px-4 py-2 text-right font-semibold">Faltante</th>
                    <th className="px-4 py-2 text-right font-semibold">Necesario</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">{m.materials?.name ?? '—'}</td>
                      <td className="tabular px-4 py-2 text-right">{formatNumber(m.quantity_required, 0)} {m.materials?.unit}</td>
                      <td className={`tabular px-4 py-2 text-right font-medium ${Number(m.quantity_missing) > 0 ? 'text-critical' : 'text-success'}`}>
                        {formatNumber(m.quantity_missing, 0)}
                      </td>
                      <td className="tabular px-4 py-2 text-right text-content-muted">{formatDate(m.needed_by_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {checklist ? (
            <ChecklistPanel
              projectCode={project.code}
              title={checklist.name}
              items={checklist.checklist_items ?? []}
              revalidatePath={`${base}/operaciones/fabricacion/${id}`}
              editable={can(project, 'manufacturing.update')}
            />
          ) : null}

          {mp.sale_id ? (
            <Card>
              <SectionTitle>Venta</SectionTitle>
              <Link href={`${base}/ventas/${mp.sale_id}`} className="text-sm text-accent hover:underline">
                Ver ficha de venta →
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
