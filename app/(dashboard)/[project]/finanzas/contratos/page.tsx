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

export const metadata: Metadata = { title: 'Contratos' };

type Row = {
  id: string; contract_number: string; title: string; contract_date: string;
  end_date: string | null; amount: number; currency: string; status: string;
  sale_id: string | null; clients: { company_name: string } | null;
};

export default async function ContractsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;
  const today = new Date().toISOString().slice(0, 10);

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'contracts',
    select: 'id, contract_number, title, contract_date, end_date, amount, currency, status, sale_id, clients(company_name)',
    projectId: project.id, params: sp,
    searchColumns: ['contract_number', 'title'],
    filters: { status: 'status' },
    orderBy: { column: 'contract_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Contratos" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Contrato', cell: (r) => (
      <span>{r.contract_number}
        <span className="block truncate text-2xs font-normal text-content-muted">{r.title}</span>
      </span>
    )},
    { key: 'client', header: 'Cliente', cell: (r) => <span className="text-content-secondary">{r.clients?.company_name ?? '—'}</span> },
    { key: 'date', header: 'Firma', hideOnMobile: true, cell: (r) => <span className="tabular">{formatDate(r.contract_date)}</span> },
    { key: 'end', header: 'Vence', cell: (r) => {
      const soon = r.end_date && r.end_date >= today && r.end_date <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      return <span className={`tabular ${soon ? 'text-warning' : 'text-content-secondary'}`}>{formatDate(r.end_date)}</span>;
    }},
    { key: 'amount', header: 'Importe', align: 'right', cell: (r) => <span className="tabular font-medium">{formatMoney(r.amount, r.currency as never)}</span> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'sale', header: '', align: 'right', hideOnMobile: true, cell: (r) =>
      r.sale_id ? <Link href={`${base}/ventas/${r.sale_id}`} className="text-2xs text-accent hover:underline">venta →</Link> : null },
  ];

  return (
    <>
      <PageHeader title="Contratos" subtitle={`${total} contratos`}
        actions={
          can(project, 'contracts.create') ? (
            <Link href={`${base}/finanzas/contratos/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo contrato
            </Link>
          ) : null
        }
      />
      <TableToolbar placeholder="Buscar contrato..."
        filters={[{ name: 'status', label: 'Estado', options: ['BORRADOR','EN_REVISION','FIRMADO','VIGENTE','CUMPLIDO','VENCIDO','RESCINDIDO'].map((s) => ({ value: s, label: s.replace(/_/g,' ') })) }]} />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/finanzas/contratos/form/${r.id}`} total={total} page={page} pageSize={pageSize}
        baseParams={carryParams(sp)} emptyTitle="Sin contratos" />
    </>
  );
}
