'use client';

import { saveClient } from '@/actions/crm';
import { EntityForm } from '@/components/forms/entity-form';
import {
  FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CLIENT_STATUSES, CURRENCIES, LEAD_SOURCES } from '@/lib/validations/commercial';
import type { CurrencyCode } from '@/types/database.types';

export interface ClientRecord {
  id: string; company_name: string; legal_name: string | null; tax_id: string | null;
  country: string | null; city: string | null; address: string | null;
  postal_code: string | null; website: string | null; industry: string | null;
  status: string; source: string | null; preferred_currency: string | null;
  payment_terms: string | null; credit_limit: number | null; notes: string | null;
}

export function ClientForm({
  projectCode, record, cancelHref, currency,
}: {
  projectCode: string; record: ClientRecord | null;
  cancelHref: string; currency: CurrencyCode;
}) {
  return (
    <EntityForm action={saveClient} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Identificacion">
        <FormGrid>
          <TextField name="company_name" label="Nombre comercial" required
            defaultValue={record?.company_name} placeholder="Club Padel Madrid" />
          <TextField name="legal_name" label="Razon social" defaultValue={record?.legal_name} />
          <TextField name="tax_id" label="CIF / NIF" defaultValue={record?.tax_id} />
          <TextField name="industry" label="Sector" defaultValue={record?.industry}
            placeholder="CLUB_DEPORTIVO" />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PROSPECTO'}
            options={CLIENT_STATUSES.map((s) => ({ value: s, label: s }))} />
          <SelectField name="source" label="Origen" defaultValue={record?.source}
            options={LEAD_SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </FormGrid>
      </FormSection>

      <FormSection title="Ubicacion">
        <FormGrid cols={3}>
          <TextField name="address" label="Direccion" className="sm:col-span-2"
            defaultValue={record?.address} />
          <TextField name="postal_code" label="Codigo postal" defaultValue={record?.postal_code} />
          <TextField name="city" label="Ciudad" defaultValue={record?.city} />
          <TextField name="country" label="Pais (ISO 2)" maxLength={2}
            defaultValue={record?.country} placeholder="ES" />
          <TextField name="website" label="Sitio web" defaultValue={record?.website}
            placeholder="clubpadelmadrid.es" />
        </FormGrid>
      </FormSection>

      <FormSection title="Condiciones comerciales">
        <FormGrid cols={3}>
          <SelectField name="preferred_currency" label="Moneda preferida"
            defaultValue={record?.preferred_currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <TextField name="payment_terms" label="Forma de pago" defaultValue={record?.payment_terms}
            placeholder="30% anticipo / 70% entrega" />
          <MoneyField name="credit_limit" label="Limite de credito" currency={currency}
            defaultValue={record?.credit_limit} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
