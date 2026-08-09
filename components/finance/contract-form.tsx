'use client';

import { saveContract } from '@/actions/finance';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CONTRACT_STATUSES, CURRENCIES } from '@/lib/validations/finance';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface ContractRecord {
  id: string; contract_number: string; title: string; client_id: string | null;
  sale_id: string | null; contract_date: string; start_date: string | null;
  end_date: string | null; amount: number; currency: string;
  payment_terms: string | null; warranty_terms: string | null; penalty_terms: string | null;
  status: string; signed_by_client: string | null; notes: string | null;
}

export function ContractForm({
  projectCode, record, cancelHref, currency, clients, sales,
}: {
  projectCode: string; record: ContractRecord | null; cancelHref: string;
  currency: CurrencyCode; clients: Option[]; sales: Option[];
}) {
  return (
    <EntityForm action={saveContract} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Contrato">
        <FormGrid>
          <TextField name="contract_number" label="Numero de contrato" required
            defaultValue={record?.contract_number} placeholder="CTR-EUROPA-2026-0001"
            hint="A diferencia de facturas y ventas, este numero no se genera solo." />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'BORRADOR'}
            options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <TextField name="title" label="Titulo" required className="sm:col-span-2"
            defaultValue={record?.title} placeholder="Suministro e instalacion de 4 canchas" />
          <SelectField name="client_id" label="Cliente" defaultValue={record?.client_id} options={clients} />
          <SelectField name="sale_id" label="Venta asociada" defaultValue={record?.sale_id} options={sales} />
        </FormGrid>
      </FormSection>

      <FormSection title="Importe y vigencia">
        <FormGrid cols={3}>
          <MoneyField name="amount" label="Importe" currency={currency} defaultValue={record?.amount} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <DateField name="contract_date" label="Fecha del contrato" required
            defaultValue={record?.contract_date ?? new Date().toISOString().slice(0, 10)} />
          <DateField name="start_date" label="Inicio" defaultValue={record?.start_date} />
          <DateField name="end_date" label="Fin" defaultValue={record?.end_date} />
          <TextField name="signed_by_client" label="Firmado por" defaultValue={record?.signed_by_client} />
        </FormGrid>
      </FormSection>

      <FormSection title="Condiciones">
        <div className="space-y-4">
          <TextAreaField name="payment_terms" label="Forma de pago" rows={2} defaultValue={record?.payment_terms} />
          <TextAreaField name="warranty_terms" label="Garantias" rows={2} defaultValue={record?.warranty_terms} />
          <TextAreaField name="penalty_terms" label="Penalizaciones" rows={2} defaultValue={record?.penalty_terms} />
          <TextAreaField name="notes" label="Notas" rows={2} defaultValue={record?.notes} />
        </div>
      </FormSection>
    </EntityForm>
  );
}
