import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { getDocumentTypeOptions } from '@/lib/services/documents';
import { formatDate, formatNumber } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';
import { DocumentUploader } from '@/components/documents/document-uploader';

export const metadata: Metadata = { title: 'Documentos' };

type Row = {
  id: string; name: string; bucket: string; storage_path: string; mime_type: string | null;
  file_size: number | null; status: string; is_confidential: boolean; created_at: string;
  current_version: number; type_name: string; type_category: string;
  link_count: number; version_count: number;
  approval_pending: boolean; extraction_pending: boolean; is_expired: boolean;
};

export default async function DocumentsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const [list, documentTypes] = await Promise.all([
    fetchList<Row>({
      from: 'v_documents',
      select:
        'id, name, bucket, storage_path, mime_type, file_size, status, is_confidential, created_at,' +
        ' current_version, type_name, type_category, link_count, version_count,' +
        ' approval_pending, extraction_pending, is_expired',
      projectId: project.id, params: sp,
      searchColumns: ['name'],
      filters: { status: 'status', bucket: 'bucket', categoria: 'type_category' },
      orderBy: { column: 'created_at', ascending: false },
    }),
    getDocumentTypeOptions(),
  ]);

  const { rows, total, page, pageSize, error } = list;

  if (error) return (<><PageHeader title="Documentos" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Documento', cell: (r) => (
      <span>{r.name}
        <span className="block text-2xs font-normal text-content-muted">
          {r.type_name}
          {r.version_count > 1 ? ` · v${r.current_version}` : null}
          {r.link_count > 0 ? ` · ${r.link_count} asociacion${r.link_count === 1 ? '' : 'es'}` : null}
        </span>
      </span>
    )},
    { key: 'category', header: 'Categoria', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{r.type_category}</span> },
    { key: 'bucket', header: 'Bucket', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.bucket}</span> },
    { key: 'size', header: 'Tamano', align: 'right', hideOnMobile: true, cell: (r) =>
      <span className="tabular text-content-muted">{r.file_size ? `${formatNumber(r.file_size / 1024, 0)} KB` : '—'}</span> },
    { key: 'date', header: 'Subido', cell: (r) => <span className="tabular">{formatDate(r.created_at)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={r.status} />
        {r.is_confidential ? <span className="badge border border-critical/30 bg-critical/15 text-critical">Confidencial</span> : null}
        {r.approval_pending ? <span className="badge border border-warning/30 bg-warning/15 text-warning">Aprobacion pendiente</span> : null}
        {r.extraction_pending ? <span className="badge border border-accent/30 bg-accent/15 text-accent">IA por revisar</span> : null}
        {r.is_expired ? <span className="badge border border-critical/30 bg-critical/15 text-critical">Vencido</span> : null}
      </span>
    )},
  ];

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle={`${total} documentos · los archivos viven en Supabase Storage, con acceso por URL firmada`}
        actions={
          can(project, 'ai.view') ? (
            <Link href={`/${projectCode}/ia`} className="btn-secondary">Revision de IA</Link>
          ) : null
        }
      />

      {can(project, 'documents.upload') && documentTypes.length > 0 ? (
        <div className="mb-6">
          <DocumentUploader projectCode={project.code} documentTypes={documentTypes} />
        </div>
      ) : null}

      <TableToolbar placeholder="Buscar documento..."
        filters={[
          { name: 'categoria', label: 'Categoria', options: ['COMERCIAL','LEGAL','TECNICO','FINANCIERO','LOGISTICO','CALIDAD'].map((s) => ({ value: s, label: s })) },
          { name: 'bucket', label: 'Bucket', options: ['documents','photos','designs','quotes','invoices','contracts'].map((s) => ({ value: s, label: s })) },
          { name: 'status', label: 'Estado', options: ['BORRADOR','EN_REVISION','CORRECCION','APROBADO','RECHAZADO','VIGENTE','OBSOLETO'].map((s) => ({ value: s, label: s.replace(/_/g,' ') })) },
        ]} />

      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        rowHref={(r) => `/${projectCode}/documentos/${r.id}`}
        baseParams={carryParams(sp)} emptyTitle="Sin documentos"
        emptyDescription="Un documento puede asociarse a cliente, venta, cancha, factura, embarque o instalacion sin duplicar el archivo." />
    </>
  );
}
