import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { getMaterialOptions } from '@/lib/services/options';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { Card, DataPoint, Field, PageHeader, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { PurchaseOrderLines, type PurchaseOrderLine } from '@/components/operations/purchase-order-lines';
import type { CurrencyCode } from '@/types/database.types';

export const metadata: Metadata = { title: 'Orden de compra' };

export default async function PurchaseOrderDetailPage({
  params,
}: { params: Promise<{ project: string; id: string }> }) {
  const { project: projectCode, id } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();
  const base = `/${project.code}`;

  const { data } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(company_name)')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) notFound();

  const po = data as unknown as {
    id: string; po_number: string; order_date: string; expected_delivery_date: string | null;
    actual_delivery_date: string | null; status: string; currency: CurrencyCode;
    subtotal: number; tax_rate: number; tax: number; total: number;
    payment_terms: string | null; delivery_address: string | null; notes: string | null;
    sale_id: string | null; manufacturing_project_id: string | null;
    suppliers: { company_name: string } | null;
  };

  const [itemsRes, materials] = await Promise.all([
    supabase
      .from('purchase_order_items')
      .select('id, description, material_id, quantity, unit, unit_price, subtotal, quantity_received')
      .eq('purchase_order_id', id)
      .order('created_at'),
    getMaterialOptions(project.id),
  ]);

  const lines = (itemsRes.data ?? []) as PurchaseOrderLine[];
  const editable = can(project, 'purchases.update');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`${base}/operaciones/compras`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Ordenes de compra
          </Link>
        }
        title={<span className="flex items-center gap-3">{po.po_number}<StatusBadge status={po.status} /></span>}
        subtitle={po.suppliers?.company_name}
        actions={editable ? (
          <Link href={`${base}/operaciones/compras/form/${po.id}`} className="btn-secondary">
            <Pencil size={14} /> Editar
          </Link>
        ) : null}
      />

      <section className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><DataPoint label="Base imponible" value={formatMoney(po.subtotal, po.currency)} /></Card>
        <Card><DataPoint label="IVA" value={formatMoney(po.tax, po.currency)}
          hint={formatPercent(po.tax_rate, 0)} /></Card>
        <Card><DataPoint label="Total" value={formatMoney(po.total, po.currency)} tone="accent" /></Card>
        <Card><DataPoint label="Lineas" value={String(lines.length)} /></Card>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PurchaseOrderLines projectCode={project.code} purchaseOrderId={po.id} lines={lines}
            currency={po.currency} editable={editable} total={po.total} materials={materials} />
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle>Datos</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Fecha">{formatDate(po.order_date)}</Field>
              <Field label="Entrega prevista">{formatDate(po.expected_delivery_date)}</Field>
              <Field label="Entrega real">{formatDate(po.actual_delivery_date)}</Field>
              <Field label="Moneda">{po.currency}</Field>
              <Field label="Forma de pago">{po.payment_terms ?? '—'}</Field>
              <Field label="Direccion">{po.delivery_address ?? '—'}</Field>
            </dl>
            {po.sale_id ? (
              <Link href={`${base}/ventas/${po.sale_id}`} className="mt-4 inline-block text-2xs text-accent hover:underline">
                Ver venta asociada →
              </Link>
            ) : null}
          </Card>

          {po.notes ? (
            <Card><SectionTitle>Notas</SectionTitle>
              <p className="text-sm text-content-secondary">{po.notes}</p></Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
