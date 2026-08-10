import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getDocument, getDocumentTypeOptions } from '@/lib/services/documents';
import { formatDate, formatNumber, humanize } from '@/lib/format';
import { Card, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { DocumentUploader } from '@/components/documents/document-uploader';
import {
  ApprovalDecision, DownloadDocumentButton, RequestApprovalButton, UnlinkButton,
} from '@/components/documents/document-actions';
import { ExtractionPanel, type ExtractionRow } from '@/components/ai/extraction-panel';

interface DocumentVersionRow {
  id: string; version: number; storage_path: string; file_size: number | null;
  comment: string | null; created_at: string;
}
interface DocumentLinkRow {
  id: string; entity_type: string; entity_id: string; relation: string | null; created_at: string;
}
interface ApprovalRow {
  id: string; status: string; requested_at: string; decided_at: string | null;
  comment: string | null; approver_user_id: string | null;
}

export const metadata: Metadata = { title: 'Documento' };

/**
 * Ficha documental (FASE 10).
 *
 * Reune en una pantalla las cuatro cosas que se preguntan de un
 * documento: que es, quien lo aprobo, a que se asocia y como ha ido
 * cambiando. La quinta —que dice la IA que contiene— aparece solo si el
 * tipo admite extraccion, y siempre como propuesta pendiente de revision.
 */
export default async function DocumentDetailPage({
  params,
}: { params: Promise<{ project: string; id: string }> }) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);

  const doc = await getDocument(id, project.id);
  if (!doc) notFound();

  const supabase = await createClient();

  const [versionsRes, linksRes, approvalsRes, extractionsRes, documentTypes] = await Promise.all([
    supabase.from('document_versions')
      .select('*')
      .eq('document_id', id).order('version', { ascending: false }),
    supabase.from('document_links')
      .select('id, entity_type, entity_id, relation, created_at')
      .eq('document_id', id).order('created_at'),
    supabase.from('approvals')
      .select('id, status, requested_at, decided_at, comment, approver_user_id')
      .eq('entity_type', 'DOCUMENT').eq('entity_id', id)
      .order('requested_at', { ascending: false }),
    supabase.from('v_ai_extraction_queue')
      .select('*')
      .eq('document_id', id).order('created_at', { ascending: false }),
    getDocumentTypeOptions(),
  ]);

  // Las vistas y las tablas con embeds no estan en los tipos generados:
  // se tipan aqui, en el punto donde se consumen.
  const versions = (versionsRes.data ?? []) as unknown as DocumentVersionRow[];
  const links = (linksRes.data ?? []) as unknown as DocumentLinkRow[];
  const approvals = (approvalsRes.data ?? []) as unknown as ApprovalRow[];
  const extractions = (extractionsRes.data ?? []) as unknown as ExtractionRow[];
  const pendingApproval = approvals.find((a) => a.status === 'PENDIENTE');
  const type = doc.document_types;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/${projectCode}/documentos`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Documentos
          </Link>
        }
        title={doc.name}
        subtitle={`${type?.name ?? 'Documento'} · ${type?.category ?? ''} · version ${doc.current_version}`}
        actions={<DownloadDocumentButton projectCode={projectCode} documentId={doc.id} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle title="Ficha" />
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Estado"><StatusBadge status={doc.status} /></Field>
              <Field label="Bucket">{doc.bucket}</Field>
              <Field label="Tamano">
                {doc.file_size ? `${formatNumber(doc.file_size / 1024, 0)} KB` : '—'}
              </Field>
              <Field label="Formato">{doc.mime_type ?? '—'}</Field>
              <Field label="Subido">{formatDate(doc.created_at)}</Field>
              <Field label="Por">{doc.profiles?.full_name ?? '—'}</Field>
              <Field label="Vigente desde">{doc.valid_from ? formatDate(doc.valid_from) : '—'}</Field>
              <Field label="Vigente hasta">{doc.valid_until ? formatDate(doc.valid_until) : '—'}</Field>
              <Field label="Confidencial">{doc.is_confidential ? 'Si' : 'No'}</Field>
            </dl>
            {doc.description ? (
              <p className="mt-4 border-t border-line pt-4 text-sm text-content-secondary">{doc.description}</p>
            ) : null}
            {doc.file_hash ? (
              <p className="mt-3 break-all text-2xs text-content-muted">
                SHA-256 {doc.file_hash}
              </p>
            ) : null}
          </Card>

          {/* ----------------------------------------------------------
              Extraccion con IA. Solo se ofrece si el tipo documental la
              admite, y lo que produce es SIEMPRE una propuesta: nada se
              escribe en el negocio sin que una persona lo confirme (§42).
          ---------------------------------------------------------- */}
          {type?.ai_extraction_type ? (
            <ExtractionPanel
              projectCode={projectCode}
              documentId={doc.id}
              extractionType={type.ai_extraction_type}
              extractions={extractions}
              canExtract={can(project, 'ai.create')}
              canReview={can(project, 'documents.approve')}
              canApply={can(project, 'invoices.create')}
            />
          ) : null}

          <Card className="p-5">
            <SectionTitle title="Versiones" subtitle={`${Math.max(versions.length, 1)} en el historial`} />
            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-content-muted">
                Solo existe el archivo original. Al subir una version nueva se conserva la anterior.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">v{v.version}</span>
                        {v.comment ? <span className="text-content-secondary"> · {v.comment}</span> : null}
                      </p>
                      <p className="text-2xs text-content-muted">
                        {formatDate(v.created_at)}
                        {v.file_size ? ` · ${formatNumber(v.file_size / 1024, 0)} KB` : ''}
                      </p>
                    </div>
                    <DownloadDocumentButton projectCode={projectCode} versionId={v.id} label="Ver" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle title="Asociaciones" subtitle="El archivo se guarda una vez y se referencia desde donde haga falta" />
            {links.length === 0 ? (
              <p className="mt-3 text-sm text-content-muted">Sin asociaciones.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm">{humanize(l.entity_type)}{l.relation ? ` · ${l.relation}` : ''}</p>
                      <p className="truncate text-2xs text-content-muted">{l.entity_id}</p>
                    </div>
                    {can(project, 'documents.update') ? (
                      <UnlinkButton projectCode={projectCode} linkId={l.id} documentId={doc.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="Aprobacion" />
            {pendingApproval ? (
              can(project, 'documents.approve') ? (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-content-secondary">
                    Solicitada el {formatDate(pendingApproval.requested_at)}.
                  </p>
                  <ApprovalDecision
                    projectCode={projectCode}
                    approvalId={pendingApproval.id}
                    documentId={doc.id}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-content-muted">
                  Pendiente desde el {formatDate(pendingApproval.requested_at)}. Tu rol no puede resolverla.
                </p>
              )
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-content-muted">Sin solicitudes pendientes.</p>
                {can(project, 'documents.update') ? (
                  <RequestApprovalButton projectCode={projectCode} documentId={doc.id} />
                ) : null}
              </div>
            )}

            {approvals.filter((a) => a.status !== 'PENDIENTE').length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {approvals.filter((a) => a.status !== 'PENDIENTE').map((a) => (
                  <li key={a.id} className="text-2xs text-content-muted">
                    <StatusBadge status={a.status} />{' '}
                    {a.decided_at ? formatDate(a.decided_at) : ''}
                    {a.comment ? ` · ${a.comment}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {can(project, 'documents.upload') && type?.is_versioned ? (
            <DocumentUploader
              projectCode={project.code}
              documentTypes={documentTypes}
              mode="version"
              documentId={doc.id}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
