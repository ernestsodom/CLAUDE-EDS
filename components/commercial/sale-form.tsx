'use client';

import { saveSale } from '@/actions/sales';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, SALE_STATUSES } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface SaleRecord {
  id: string; client_id: string; opportunity_id: string | null; sale_number: string;
  sale_date: string; status: string; currency: string; tax_rate: number;
  delivery_date: string | null; payment_terms: string | null; incoterm: string | null;
  delivery_address: string | null; delivery_country: string | null;
  delivery_city: string | null; notes: string | null;
}

/**
 * Cabecera de venta.
 *
 * Los importes no se editan aqui: salen de las lineas. Y el estado no se
 * usa para "confirmar": eso lo hace el boton Confirmar venta, que ademas
 * genera canchas, fabricacion, costos y checklists en una transaccion.
 */
export function SaleForm({
  projectCode, record, cancelHref, currency, clients, opportunities,
}: {
  projectCode: string; record: SaleRecord | null; cancelHref: string;
  currency: CurrencyCode; clients: Option[]; opportunities: Option[];
}) {
  return (
    <EntityForm action={saveSale} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Venta">
        <FormGrid>
          <SelectField name="client_id" label="Cliente" required options={clients}
            defaultValue={record?.client_id} />
          <SelectField name="opportunity_id" label="Oportunidad de origen" options={opportunities}
            defaultValue={record?.opportunity_id} />
          <TextField name="sale_number" label="Numero de venta" defaultValue={record?.sale_number}
            hint="Si lo dejas vacio se genera automaticamente." />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'BORRADOR'}
            options={SALE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
            hint="Para confirmar la venta usa el boton de la ficha, no este campo." />
          <DateField name="sale_date" label="Fecha de venta" required
            defaultValue={record?.sale_date ?? new Date().toISOString().slice(0, 10)} />
          <DateField name="delivery_date" label="Entrega comprometida" defaultValue={record?.delivery_date} />
        </FormGrid>
      </FormSection>

      <FormSection title="Condiciones economicas"
        description="El subtotal y el total se calculan a partir de las lineas de la venta.">
        <FormGrid cols={3}>
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <NumberField name="tax_rate" label="IVA" step="0.01" min={0} max={100} suffix="%"
            defaultValue={record?.tax_rate ?? 0} />
          <TextField name="incoterm" label="Incoterm" defaultValue={record?.incoterm} placeholder="DAP" />
          <TextField name="payment_terms" label="Forma de pago" className="sm:col-span-2"
            defaultValue={record?.payment_terms} placeholder="30% anticipo / 70% contra entrega" />
        </FormGrid>
      </FormSection>

      <FormSection title="Entrega">
        <FormGrid cols={3}>
          <TextField name="delivery_address" label="Direccion" className="sm:col-span-2"
            defaultValue={record?.delivery_address} />
          <TextField name="delivery_city" label="Ciudad" defaultValue={record?.delivery_city} />
          <TextField name="delivery_country" label="Pais (ISO 2)" maxLength={2}
            defaultValue={record?.delivery_country} placeholder="ES" />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
