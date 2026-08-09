import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { fetchList, carryParams, type ListParams } from '@/lib/services/list';
import { formatDate, humanize } from '@/lib/format';
import { ErrorState, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Logistica' };

type Row = {
  id: string; shipment_number: string; transport_mode: string;
  origin: string | null; destination: string | null; carrier: string | null;
  container_number: string | null; bl_number: string | null;
  departure_date: string | null; estimated_arrival: string | null;
  customs_status: string; status: string;
};

export default async function LogisticsPage({
  params, searchParams,
}: { params: Promise<{ project: string }>; searchParams: Promise<ListParams> }) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);
  const base = `/${project.code}`;

  const { rows, total, page, pageSize, error } = await fetchList<Row>({
    from: 'shipments',
    select: 'id, shipment_number, transport_mode, origin, destination, carrier, container_number, bl_number, departure_date, estimated_arrival, customs_status, status',
    projectId: project.id, params: sp,
    searchColumns: ['shipment_number', 'container_number', 'bl_number'],
    filters: { status: 'status' },
    orderBy: { column: 'departure_date', ascending: false },
    softDelete: true,
  });

  if (error) return (<><PageHeader title="Logistica" /><ErrorState /></>);

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Embarque', cell: (r) => (
      <span>{r.shipment_number}
        <span className="block text-2xs font-normal text-content-muted">{humanize(r.transport_mode)}</span>
      </span>
    )},
    { key: 'route', header: 'Ruta', cell: (r) => (
      <span className="text-content-secondary">{r.origin ?? '—'} → {r.destination ?? '—'}</span>
    )},
    { key: 'container', header: 'Contenedor / BL', hideOnMobile: true, cell: (r) => (
      <span className="text-2xs text-content-muted">
        {r.container_number ?? '—'}
        {r.bl_number ? <span className="block">{r.bl_number}</span> : null}
      </span>
    )},
    { key: 'departure', header: 'Salida', hideOnMobile: true, cell: (r) => <span className="tabular">{formatDate(r.departure_date)}</span> },
    { key: 'eta', header: 'ETA', cell: (r) => <span className="tabular">{formatDate(r.estimated_arrival)}</span> },
    { key: 'customs', header: 'Aduana', hideOnMobile: true, cell: (r) => <StatusBadge status={r.customs_status} /> },
    { key: 'status', header: 'Estado', cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Logistica"
        subtitle={`${total} embarques`}
        actions={
          can(project, 'logistics.create') ? (
            <Link href={`${base}/operaciones/logistica/form`} className="btn-primary">
              <Plus size={15} />
              Nuevo embarque
            </Link>
          ) : null
        }
      />
      <TableToolbar placeholder="Buscar por embarque, contenedor o BL..."
        filters={[{ name: 'status', label: 'Estado', options: ['PLANIFICADO','RESERVADO','CARGADO','EN_TRANSITO','EN_ADUANA','LIBERADO','ENTREGADO','INCIDENCIA'].map((s) => ({ value: s, label: s.replace(/_/g,' ') })) }]} />
      <DataTable columns={columns} rows={rows} rowHref={(r) => `${base}/operaciones/logistica/${r.id}`}
        total={total} page={page} pageSize={pageSize} baseParams={carryParams(sp)}
        emptyTitle="Sin embarques" />
    </>
  );
}
