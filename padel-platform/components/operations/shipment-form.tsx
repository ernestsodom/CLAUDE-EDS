'use client';

import { saveShipment } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { humanize } from '@/lib/format';
import {
  CURRENCIES, CUSTOMS_STATUSES, SHIPMENT_STATUSES, TRANSPORT_MODES,
} from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface ShipmentRecord {
  id: string; shipment_number: string; sale_id: string | null; client_id: string | null;
  transport_mode: string; origin: string | null; origin_country: string | null;
  destination: string | null; destination_country: string | null; carrier: string | null;
  forwarder: string | null; container_number: string | null; container_type: string | null;
  booking_number: string | null; bl_number: string | null; incoterm: string | null;
  departure_date: string | null; estimated_arrival: string | null; actual_arrival: string | null;
  customs_status: string; customs_cleared_at: string | null; status: string;
  freight_cost: number | null; insurance_cost: number | null; customs_cost: number | null;
  currency: string; notes: string | null;
}

export function ShipmentForm({
  projectCode, record, cancelHref, currency, clients, sales,
}: {
  projectCode: string; record: ShipmentRecord | null; cancelHref: string;
  currency: CurrencyCode; clients: Option[]; sales: Option[];
}) {
  return (
    <EntityForm action={saveShipment} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Embarque">
        <FormGrid>
          <TextField name="shipment_number" label="Numero" defaultValue={record?.shipment_number}
            hint="Si lo dejas vacio se genera automaticamente." />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PLANIFICADO'}
            options={SHIPMENT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            hint="Al pasar a EN_TRANSITO, sus canchas cambian de estado automaticamente." />
          <SelectField name="transport_mode" label="Modo de transporte" allowEmpty={false}
            defaultValue={record?.transport_mode ?? 'MARITIMO'}
            options={TRANSPORT_MODES.map((m) => ({ value: m, label: humanize(m) }))} />
          <TextField name="incoterm" label="Incoterm" defaultValue={record?.incoterm} placeholder="CIF" />
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <SelectField name="client_id" label="Cliente" options={clients} defaultValue={record?.client_id} />
        </FormGrid>
      </FormSection>

      <FormSection title="Ruta">
        <FormGrid>
          <TextField name="origin" label="Origen" defaultValue={record?.origin} placeholder="Valencia" />
          <TextField name="origin_country" label="Pais origen (ISO 2)" maxLength={2}
            defaultValue={record?.origin_country} />
          <TextField name="destination" label="Destino" defaultValue={record?.destination} />
          <TextField name="destination_country" label="Pais destino (ISO 2)" maxLength={2}
            defaultValue={record?.destination_country} />
          <TextField name="carrier" label="Transportista" defaultValue={record?.carrier} />
          <TextField name="forwarder" label="Forwarder" defaultValue={record?.forwarder} />
        </FormGrid>
      </FormSection>

      <FormSection title="Documentacion y aduana">
        <FormGrid cols={3}>
          <TextField name="container_number" label="Contenedor" defaultValue={record?.container_number} />
          <TextField name="container_type" label="Tipo" defaultValue={record?.container_type}
            placeholder="40HC" />
          <TextField name="booking_number" label="Booking" defaultValue={record?.booking_number} />
          <TextField name="bl_number" label="BL" defaultValue={record?.bl_number} />
          <SelectField name="customs_status" label="Aduana" allowEmpty={false}
            defaultValue={record?.customs_status ?? 'NO_APLICA'}
            options={CUSTOMS_STATUSES.map((c) => ({ value: c, label: humanize(c) }))} />
          <DateField name="customs_cleared_at" label="Liberado el" defaultValue={record?.customs_cleared_at} />
        </FormGrid>
      </FormSection>

      <FormSection title="Fechas y costos">
        <FormGrid cols={3}>
          <DateField name="departure_date" label="Salida" defaultValue={record?.departure_date} />
          <DateField name="estimated_arrival" label="Llegada estimada" defaultValue={record?.estimated_arrival} />
          <DateField name="actual_arrival" label="Llegada real" defaultValue={record?.actual_arrival} />
          <MoneyField name="freight_cost" label="Flete" currency={currency} defaultValue={record?.freight_cost} />
          <MoneyField name="insurance_cost" label="Seguro" currency={currency} defaultValue={record?.insurance_cost} />
          <MoneyField name="customs_cost" label="Aduana" currency={currency} defaultValue={record?.customs_cost} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" rows={2} defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
