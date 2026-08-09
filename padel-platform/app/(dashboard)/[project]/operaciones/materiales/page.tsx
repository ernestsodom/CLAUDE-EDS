import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatNumber } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';

export const metadata: Metadata = { title: 'Materiales' };

type Row = {
  id: string; quantity_required: number; quantity_available: number;
  quantity_purchased: number; quantity_missing: number; needed_by_date: string | null;
  materials: { code: string; name: string; unit: string } | null;
  manufacturing_projects: { name: string } | null;
};

export default async function MaterialsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'material_requirements',
    select: 'id, quantity_required, quantity_available, quantity_purchased, quantity_missing, needed_by_date, materials(code, name, unit), manufacturing_projects(name)',
    projectId: project.id,
    params: sp,
    orderBy: { column: 'needed_by_date', ascending: true },
  });

  if (error) return (<><PageHeader title="Materiales" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'material', header: 'Material', cell: (r) => (
      <span>{r.materials?.name ?? '—'}
        <span className="block text-2xs font-normal text-content-muted">{r.materials?.code}</span>
      </span>
    )},
    { key: 'mp', header: 'Fabricacion', hideOnMobile: true, cell: (r) => <span className="text-content-secondary">{r.manufacturing_projects?.name ?? '—'}</span> },
    { key: 'required', header: 'Requerido', align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.quantity_required, 0)} {r.materials?.unit}</span> },
    { key: 'available', header: 'Disponible', align: 'right', hideOnMobile: true, cell: (r) => <span className="tabular text-content-secondary">{formatNumber(r.quantity_available, 0)}</span> },
    { key: 'purchased', header: 'Comprado', align: 'right', hideOnMobile: true, cell: (r) => <span className="tabular text-content-secondary">{formatNumber(r.quantity_purchased, 0)}</span> },
    { key: 'missing', header: 'Faltante', align: 'right', cell: (r) => (
      <span className={`tabular font-semibold ${Number(r.quantity_missing) > 0 ? 'text-critical' : 'text-success'}`}>
        {formatNumber(r.quantity_missing, 0)}
      </span>
    )},
    { key: 'needed', header: 'Necesario para', align: 'right', hideOnMobile: true, cell: (r) => <span className="tabular text-content-muted">{formatDate(r.needed_by_date)}</span> },
  ];

  return (
    <>
      <PageHeader title="Materiales" subtitle={`${total} requerimientos`}
        actions={
          can(project, 'materials.create') ? (
            <Link href={`${base}/operaciones/materiales/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo requerimiento
            </Link>
          ) : null
        }
      />
      <TableToolbar placeholder="Buscar material..." />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/operaciones/materiales/form/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin requerimientos"
        emptyDescription="El faltante se calcula como requerido menos disponible menos comprado, y nunca es negativo." />
    </>
  );
}
