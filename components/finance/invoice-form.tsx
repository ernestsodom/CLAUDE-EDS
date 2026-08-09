'use client';

import { useState } from 'react';
import { saveInvoice } from '@/actions/finance';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, INVOICE_STATUSES } from '@/lib/validations/finance';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface InvoiceRecord {
  id: string; kind: string; invoice_number: string; external_number: string | null;
  invoice_date: string; due_date: string | null; status: string; currency: string;
  tax_rate: number; client_id: string | null; sale_id: string | null;
  supplier_id: string | null; purchase_order_id: string | null; notes: string | null;
}

/**
 * Cabecera de factura.
 *
 * No hay campos de subtotal, IVA ni total: los calcula un trigger a partir
 * de las lineas. Tampoco `paid_amount`, que se deriva de los pagos. Si el
 * formulario los enviara, cabecera y detalle podrian dejar de cuadrar.
 */
export function InvoiceForm({
  projectCode, record, cancelHref, currency, clients, suppliers, sales, purchaseOrders,
}: {
  projectCode: string; record: InvoiceRecord | null; cancelHref: string; currency: CurrencyCode;
  clients: Option[]; suppliers: Option[]; sales: Option[]; purchaseOrders: Option[];
}) {
  const [kind, setKind] = useState(record?.kind ?? 'VENTA');
  const isSale = kind === 'VENTA';

  return (
    <EntityForm action={saveInvoice} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Documento">
        <FormGrid>
          <div>
            <label htmlFor="kind" className="label">
              Tipo <span className="ml-1 text-accent">*</span>
            </label>
            <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}
              disabled={Boolean(record)} className="input cursor-pointer disabled:opacity-60">
              <option value="VENTA">Factura de venta (a cliente)</option>
              <option value="COMPRA">Factura de compra (de proveedor)</option>
            </select>
            {record ? (
              <p className="mt-1 text-2xs text-content-muted">
                El tipo no se cambia una vez emitida la factura.
              </p>
            ) : null}
          </div>
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'BORRADOR'}
            options={INVOICE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <TextField name="invoice_number" label="Numero" defaultValue={record?.invoice_number}
            hint="Si lo dejas vacio se genera automaticamente." />
          {!isSale ? (
            <TextField name="external_number" label="Numero del proveedor"
              defaultValue={record?.external_number} />
          ) : null}
          <DateField name="invoice_date" label="Fecha de factura" required
            defaultValue={record?.invoice_date ?? new Date().toISOString().slice(0, 10)} />
          <DateField name="due_date" label="Vencimiento" defaultValue={record?.due_date} />
        </FormGrid>
      </FormSection>

      <FormSection title="Contraparte">
        <FormGrid>
          {isSale ? (
            <>
              <SelectField name="client_id" label="Cliente" required options={clients}
                defaultValue={record?.client_id} />
              <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
            </>
          ) : (
            <>
              <SelectField name="supplier_id" label="Proveedor" required options={suppliers}
                defaultValue={record?.supplier_id} />
              <SelectField name="purchase_order_id" label="Orden de compra" options={purchaseOrders}
                defaultValue={record?.purchase_order_id} />
            </>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Importes"
        description="El subtotal y el total se calculan a partir de las lineas de la factura.">
        <FormGrid cols={3}>
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <NumberField name="tax_rate" label="IVA" step="0.01" min={0} max={100} suffix="%"
            defaultValue={record?.tax_rate ?? 0} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
