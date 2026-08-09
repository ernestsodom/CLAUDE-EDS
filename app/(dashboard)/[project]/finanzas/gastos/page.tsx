import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, formatMoney } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Gastos' };

type Row = {
  id: string; description: string; expense_date: string; amount: number;
  currency: string; status: string;
  cost_categories: { name: string; cost_group: string } | null;
  sales: { sale_number: string } | null;
};

export default async function ExpensesPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'expenses',
    select: 'id, description, expense_date, amount, currency, status, cost_categories(name, cost_group), sales(sale_number)',
    projectId: project.id, params: sp,
    searchColumns: ['description'],
    filters: { status: 'status' },
    orderBy: { column: 'expense_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Gastos" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'date', header: 'Fecha', cell: (r) => <span className="tabular">{formatDate(r.expense_date)}</span> },
    { key: 'description', header: 'Concepto', cell: (r) => r.description },
    { key: 'category', header: 'Categoria', hideOnMobile: true, cell: (r) => (
      <span className="text-content-secondary">{r.cost_categories?.name ?? '—'}
        <span className="block text-2xs text-content-muted">{r.cost_categories?.cost_group}</span>
      </span>
    )},
    { key: 'sale', header: 'Venta', hideOnMobile: true, cell: (r) => <span className="text-2xs text-content-muted">{r.sales?.sale_number ?? 'general'}</span> },
    { key: 'amount', header: 'Importe', align: 'right', cell: (r) => <span className="tabular font-medium">{formatMoney(r.amount, r.currency as never)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Gastos" subtitle={`${total} gastos`}
        actions={
          can(project, 'expenses.create') ? (
            <Link href={`${base}/finanzas/gastos/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo gasto
            </Link>
          ) : null
        }
      />
      <TableToolbar placeholder="Buscar gasto..."
        filters={[{ name: 'status', label: 'Estado', options: ['BORRADOR','APROBADO','PAGADO','RECHAZADO'].map((s) => ({ value: s, label: s })) }]} />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/finanzas/gastos/form/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin gastos registrados" />
    </>
  );
}
