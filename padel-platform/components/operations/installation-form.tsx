'use client';

import { saveInstallation } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { INSTALLATION_STATUSES } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';

export interface InstallationRecord {
  id: string; installation_number: string; name: string | null; sale_id: string | null;
  client_id: string | null; shipment_id: string | null; address: string | null;
  city: string | null; country: string | null; postal_code: string | null;
  planned_start_date: string | null; planned_end_date: string | null;
  actual_start_date: string | null; actual_end_date: string | null; status: string;
  received_by_name: string | null; client_observations: string | null; notes: string | null;
}

export function InstallationForm({
  projectCode, record, cancelHref, clients, sales, shipments,
}: {
  projectCode: string; record: InstallationRecord | null; cancelHref: string;
  clients: Option[]; sales: Option[]; shipments: Option[];
}) {
  return (
    <EntityForm action={saveInstallation} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Instalacion">
        <FormGrid>
          <TextField name="installation_number" label="Numero" defaultValue={record?.installation_number}
            hint="Si lo dejas vacio se genera automaticamente." />
          <TextField name="name" label="Nombre" defaultValue={record?.name}
            placeholder="Instalacion Madrid ampliacion" />
          <SelectField name="client_id" label="Cliente" options={clients} defaultValue={record?.client_id} />
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <SelectField name="shipment_id" label="Embarque" options={shipments}
            defaultValue={record?.shipment_id} />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PLANIFICADA'}
            options={INSTALLATION_STATUSES.map((s) => ({ value: s, label: s }))}
            hint="Al pasar a RECEPCIONADA, sus canchas quedan entregadas automaticamente." />
        </FormGrid>
      </FormSection>

      <FormSection title="Ubicacion">
        <FormGrid cols={3}>
          <TextField name="address" label="Direccion" className="sm:col-span-2" defaultValue={record?.address} />
          <TextField name="postal_code" label="Codigo postal" defaultValue={record?.postal_code} />
          <TextField name="city" label="Ciudad" defaultValue={record?.city} />
          <TextField name="country" label="Pais (ISO 2)" maxLength={2} defaultValue={record?.country} />
        </FormGrid>
      </FormSection>

      <FormSection title="Fechas y recepcion">
        <FormGrid>
          <DateField name="planned_start_date" label="Inicio previsto" defaultValue={record?.planned_start_date} />
          <DateField name="planned_end_date" label="Fin previsto" defaultValue={record?.planned_end_date} />
          <DateField name="actual_start_date" label="Inicio real" defaultValue={record?.actual_start_date} />
          <DateField name="actual_end_date" label="Fin real" defaultValue={record?.actual_end_date} />
          <TextField name="received_by_name" label="Recibido por" defaultValue={record?.received_by_name} />
        </FormGrid>
        <TextAreaField name="client_observations" label="Observaciones del cliente" className="mt-4"
          rows={2} defaultValue={record?.client_observations} />
        <TextAreaField name="notes" label="Notas" className="mt-4" rows={2} defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
