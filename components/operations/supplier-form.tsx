'use client';

import { saveSupplier } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, SUPPLIER_STATUSES } from '@/lib/validations/operations';

export interface SupplierRecord {
  id: string; company_name: string; tax_id: string | null; country: string | null;
  city: string | null; address: string | null; contact_name: string | null;
  email: string | null; phone: string | null; category: string | null;
  currency: string; payment_terms: string | null; rating: number | null;
  status: string; notes: string | null;
}

const CATEGORIES = ['FIERRO', 'GALVANIZADO', 'VIDRIO', 'CESPED', 'ILUMINACION', 'LOGISTICA', 'SERVICIOS', 'OTROS'];

export function SupplierForm({
  projectCode, record, cancelHref,
}: { projectCode: string; record: SupplierRecord | null; cancelHref: string }) {
  return (
    <EntityForm action={saveSupplier} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Identificacion">
        <FormGrid>
          <TextField name="company_name" label="Nombre del proveedor" required
            defaultValue={record?.company_name} placeholder="Aceros del Norte S.L." />
          <TextField name="tax_id" label="CIF / NIF" defaultValue={record?.tax_id} />
          <SelectField name="category" label="Categoria" defaultValue={record?.category}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <SelectField name="status" label="Estado" allowEmpty={false} defaultValue={record?.status ?? 'ACTIVO'}
            options={SUPPLIER_STATUSES.map((s) => ({ value: s, label: s }))} />
        </FormGrid>
      </FormSection>

      <FormSection title="Contacto">
        <FormGrid>
          <TextField name="contact_name" label="Persona de contacto" defaultValue={record?.contact_name} />
          <TextField name="email" label="Email" type="email" defaultValue={record?.email} />
          <TextField name="phone" label="Telefono" type="tel" defaultValue={record?.phone} />
          <TextField name="country" label="Pais (ISO 2)" maxLength={2}
            defaultValue={record?.country} placeholder="ES" />
          <TextField name="city" label="Ciudad" defaultValue={record?.city} />
          <TextField name="address" label="Direccion" defaultValue={record?.address} />
        </FormGrid>
      </FormSection>

      <FormSection title="Condiciones comerciales">
        <FormGrid>
          <SelectField name="currency" label="Moneda" allowEmpty={false} defaultValue={record?.currency ?? 'EUR'}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <TextField name="payment_terms" label="Forma de pago"
            defaultValue={record?.payment_terms} placeholder="60 dias" />
          <NumberField name="rating" label="Valoracion" min={1} max={5} defaultValue={record?.rating}
            hint="De 1 a 5" />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
