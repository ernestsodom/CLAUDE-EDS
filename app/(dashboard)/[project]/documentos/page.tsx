import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatNumber } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Documentos' };

type Row = {
  id: string; name: string; bucket: string; storage_path: string; mime_type: string | null;
  file_size: number | null; status: string; is_confidential: boolean; created_at: string;
  document_types: { name: string; category: string } | null;
};

export default async function DocumentsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'documents',
    select: 'id, name, bucket, storage_path, mime_type, file_size, status, is_confidential, created_at, document_types(name, category)',
    projectId: project.id, params: sp,
    searchColumns: ['name'],
    filters: { status: 'status', bucket: 'bucket' },
    orderBy: { column: 'created_at', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Documentos" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Documento', cell: (r) => (
      <span>{r.name}
        <span className="block text-2xs font-normal text-content-muted">{r.document_types?.name ?? '—'}</span>
      </span>
    )},
    { key: 'category', header: 'Categoria', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{r.document_types?.category ?? '—'}</span> },
    { key: 'bucket', header: 'Bucket', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.bucket}</span> },
    { key: 'size', header: 'Tamano', align: 'right', hideOnMobile: true, cell: (r) =>
      <span className="tabular text-content-muted">{r.file_size ? `${formatNumber(r.file_size / 1024, 0)} KB` : '—'}</span> },
    { key: 'date', header: 'Subido', cell: (r) => <span className="tabular">{formatDate(r.created_at)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => (
      <span className="flex items-center gap-1.5">
        <StatusBadge status={r.status} />
        {r.is_confidential ? <span className="badge border border-critical/30 bg-critical/15 text-critical">Confidencial</span> : null}
      </span>
    )},
  ];

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle={`${total} documentos · los archivos viven en Supabase Storage, con acceso por URL firmada`}
      />
      <TableToolbar placeholder="Buscar documento..."
        filters={[
          { name: 'bucket', label: 'Bucket', options: ['documents','photos','designs','quotes','invoices','contracts'].map((s) => ({ value: s, label: s })) },
          { name: 'status', label: 'Estado', options: ['BORRADOR','EN_REVISION','CORRECCION','APROBADO','RECHAZADO','VIGENTE','OBSOLETO'].map((s) => ({ value: s, label: s.replace(/_/g,' ') })) },
        ]} />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin documentos"
        emptyDescription="Un documento puede asociarse a cliente, venta, cancha, factura, embarque o instalacion sin duplicar el archivo." />
    </>
  );
}
