'use client';

import { savePurchaseOrder } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, PO_STATUSES } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface PurchaseOrderRecord {
  id: string; supplier_id: string; po_number: string;
  manufacturing_project_id: string | null; sale_id: string | null;
  order_date: string; expected_delivery_date: string | null; actual_delivery_date: string | null;
  status: string; currency: string; tax_rate: number;
  delivery_address: string | null; payment_terms: string | null; notes: string | null;
}

export function PurchaseOrderForm({
  projectCode, record, cancelHref, currency, suppliers, manufacturing, sales,
}: {
  projectCode: string; record: PurchaseOrderRecord | null; cancelHref: string;
  currency: CurrencyCode; suppliers: Option[]; manufacturing: Option[]; sales: Option[];
}) {
  return (
    <EntityForm action={savePurchaseOrder} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Orden de compra">
        <FormGrid>
          <SelectField name="supplier_id" label="Proveedor" required options={suppliers}
            defaultValue={record?.supplier_id} />
          <TextField name="po_number" label="Numero" defaultValue={record?.po_number}
            hint="Si lo dejas vacio se genera automaticamente." />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'BORRADOR'}
            options={PO_STATUSES.map((s) => ({ value: s, label: s }))} />
          <DateField name="order_date" label="Fecha de la orden" required
            defaultValue={record?.order_date ?? new Date().toISOString().slice(0, 10)} />
          <DateField name="expected_delivery_date" label="Entrega prevista"
            defaultValue={record?.expected_delivery_date} />
          <DateField name="actual_delivery_date" label="Entrega real"
            defaultValue={record?.actual_delivery_date} />
        </FormGrid>
      </FormSection>

      <FormSection title="Imputacion">
        <FormGrid>
          <SelectField name="manufacturing_project_id" label="Proyecto de fabricacion"
            options={manufacturing} defaultValue={record?.manufacturing_project_id} />
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
        </FormGrid>
      </FormSection>

      <FormSection title="Condiciones"
        description="El total se calcula a partir de las lineas de la orden.">
        <FormGrid cols={3}>
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <NumberField name="tax_rate" label="IVA" step="0.01" min={0} max={100} suffix="%"
            defaultValue={record?.tax_rate ?? 0} />
          <TextField name="payment_terms" label="Forma de pago" defaultValue={record?.payment_terms} />
        </FormGrid>
        <TextField name="delivery_address" label="Direccion de entrega" className="mt-4"
          defaultValue={record?.delivery_address} />
        <TextAreaField name="notes" label="Notas" className="mt-4" rows={2} defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
