import type { Metadata } from 'next';
import { requireProject } from '@/lib/auth/session';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Proveedores' };

type Row = {
  id: string; company_name: string; tax_id: string | null; country: string | null;
  city: string | null; category: string | null; contact_name: string | null;
  email: string | null; phone: string | null; status: string; payment_terms: string | null;
};

export default async function SuppliersPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'suppliers',
    select: 'id, company_name, tax_id, country, city, category, contact_name, email, phone, status, payment_terms',
    projectId: project.id, params: sp,
    searchColumns: ['company_name', 'tax_id'],
    filters: { status: 'status', category: 'category' },
    orderBy: { column: 'company_name', ascending: true },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Proveedores" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Proveedor', cell: (r) => (
      <span>{r.company_name}
        {r.tax_id ? <span className="block text-2xs font-normal text-content-muted">{r.tax_id}</span> : null}
      </span>
    )},
    { key: 'category', header: 'Categoria', cell: (r) => <span className="text-content-secondary">{r.category ?? '—'}</span> },
    { key: 'location', header: 'Ubicacion', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{[r.city, r.country].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'contact', header: 'Contacto', hideOnMobile: true, cell: (r) => (
      <span className="text-2xs text-content-muted">
        {r.contact_name ?? '—'}
        {r.email ? <span className="block">{r.email}</span> : null}
      </span>
    )},
    { key: 'terms', header: 'Pago', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.payment_terms ?? '—'}</span> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Proveedores" subtitle={`${total} proveedores`} />
      <TableToolbar placeholder="Buscar proveedor..."
        filters={[{ name: 'status', label: 'Estado', options: ['ACTIVO','INACTIVO','BLOQUEADO','EVALUACION'].map((s) => ({ value: s, label: s })) }]} />
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin proveedores" />
    </>
  );
}
