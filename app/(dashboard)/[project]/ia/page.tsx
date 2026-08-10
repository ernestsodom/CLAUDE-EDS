import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { isAiEnabled } from '@/lib/ai/client';
import { getClientOptions, getSaleOptions, getSupplierOptions } from '@/lib/services/options';
import { formatDate, formatPercent } from '@/lib/format';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { AssistantChat } from '@/components/ai/assistant-chat';
import { ApplyInvoiceForm } from '@/components/ai/apply-invoice-form';

interface QueueRow {
  id: string; document_id: string; document_name: string; document_type_name: string;
  extraction_type: string; model: string; status: string; confidence: number | null;
  structured_data: Record<string, unknown> | null; error_message: string | null;
  reviewed_at: string | null; applied_at: string | null; applied_entity_id: string | null;
  created_at: string; needs_review: boolean; ready_to_apply: boolean;
}

export const metadata: Metadata = { title: 'IA' };

/**
 * Inteligencia documental y asistente (FASE 14).
 *
 * La pantalla reune las dos cosas que la IA hace en esta plataforma, y
 * ninguna de las dos escribe sola: la cola de revision espera decision
 * humana, y el asistente solo lee.
 */
export default async function AiPage({
  params, searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ aplicar?: string }>;
}) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const supabase = await createClient();

  const { data: queue } = await supabase
    .from('v_ai_extraction_queue')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (queue ?? []) as unknown as QueueRow[];
  const pending = rows.filter((r) => r.needs_review);
  const readyToApply = rows.filter((r) => r.ready_to_apply);

  const applying = sp.aplicar
    ? readyToApply.find((r) => r.id === sp.aplicar)
    : undefined;

  const [clients, suppliers, sales] = applying
    ? await Promise.all([
        getClientOptions(project.id),
        getSupplierOptions(project.id),
        getSaleOptions(project.id),
      ])
    : [[], [], []];

  return (
    <>
      <PageHeader
        title="Inteligencia documental"
        subtitle="La IA propone; una persona decide. Ningun dato extraido entra en el negocio sin aprobacion."
        actions={
          <Link href={`/${projectCode}/documentos`} className="btn-secondary">Documentos</Link>
        }
      />

      {!isAiEnabled() ? (
        <Card className="mb-6 border-warning/30 bg-warning/10 p-4">
          <p className="text-sm text-warning">
            La IA no esta configurada en este entorno: falta <code>AI_PROVIDER_API_KEY</code> en
            el servidor. El resto de la aplicacion funciona con normalidad; solo no se pueden
            lanzar extracciones ni usar el asistente.
          </p>
        </Card>
      ) : null}

      {applying ? (
        <Card className="mb-6 p-5">
          <SectionTitle
            title={`Aplicar: ${applying.document_name}`}
            subtitle="Revisa cada campo. Se guarda lo que quede en el formulario, no lo que leyo el modelo."
          />
          <div className="mt-4">
            <ApplyInvoiceForm
              projectCode={projectCode}
              extractionId={applying.id}
              suggestion={(applying.structured_data ?? {}) as Record<string, unknown>}
              clients={clients}
              suppliers={suppliers}
              sales={sales}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle
              title="Cola de revision"
              subtitle={`${pending.length} pendientes · ${readyToApply.length} aprobadas sin aplicar`}
            />

            {rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Sin extracciones"
                  description="Abre un documento de tipo factura, BL, contrato o cotizacion y lanza la lectura automatica desde su ficha."
                />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {rows.map((row) => (
                  <li key={row.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/${projectCode}/documentos/${row.document_id}`}
                          className="block truncate text-sm font-medium hover:text-accent"
                        >
                          {row.document_name}
                        </Link>
                        <p className="text-2xs text-content-muted">
                          {row.document_type_name} · {row.extraction_type} · {formatDate(row.created_at)}
                          {row.confidence !== null
                            ? ` · campos cubiertos ${formatPercent(Number(row.confidence) * 100)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={row.status} />
                        {row.ready_to_apply && can(project, 'invoices.create')
                          && row.extraction_type === 'INVOICE' ? (
                          <Link
                            href={`/${projectCode}/ia?aplicar=${row.id}`}
                            className="btn-secondary text-2xs"
                          >
                            Aplicar
                          </Link>
                        ) : null}
                        {row.applied_at ? (
                          <span className="badge border border-success/30 bg-success/15 text-success">
                            Aplicada
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {row.status === 'ERROR' && row.error_message ? (
                      <p className="mt-1 text-2xs text-critical">{row.error_message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle title="Que garantiza la base de datos" />
            <ul className="mt-3 space-y-2 text-sm text-content-secondary">
              <li>· Una extraccion no puede marcarse como aplicada si no esta aprobada: lo impide un constraint, no una comprobacion de pantalla.</li>
              <li>· Aprobar exige el permiso <code>documents.approve</code> y deja registrado quien y cuando.</li>
              <li>· La integracion de IA no tiene privilegio para escribir las columnas de revision: solo puede hacerlo la funcion que comprueba el permiso.</li>
              <li>· El asistente consulta con tu sesion, asi que RLS filtra su respuesta igual que filtra tus pantallas.</li>
            </ul>
          </Card>
        </div>

        <div>
          {can(project, 'ai.view') ? (
            <AssistantChat projectCode={projectCode} />
          ) : (
            <Card className="p-5">
              <p className="text-sm text-content-muted">
                Tu rol no tiene acceso al asistente en esta unidad de negocio.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
