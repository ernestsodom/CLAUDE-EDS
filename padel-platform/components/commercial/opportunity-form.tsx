'use client';

import { useState } from 'react';
import { saveOpportunity } from '@/actions/crm';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, MoneyField, NumberField, SelectField,
  TextAreaField, TextField,
} from '@/components/forms';
import {
  CURRENCIES, LEAD_SOURCES, OPPORTUNITY_STATUSES,
} from '@/lib/validations/commercial';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface OpportunityRecord {
  id: string; client_id: string; name: string; description: string | null;
  estimated_courts: number; estimated_amount: number; currency: string;
  probability: number; expected_close_date: string | null; status: string;
  source: string | null; lost_reason: string | null; next_action: string | null;
  next_action_date: string | null; notes: string | null;
}

export function OpportunityForm({
  projectCode, record, cancelHref, currency, clients,
}: {
  projectCode: string; record: OpportunityRecord | null; cancelHref: string;
  currency: CurrencyCode; clients: Option[];
}) {
  const [status, setStatus] = useState(record?.status ?? 'NUEVA');

  return (
    <EntityForm action={saveOpportunity} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Oportunidad">
        <FormGrid>
          <SelectField name="client_id" label="Cliente" required options={clients}
            defaultValue={record?.client_id} />
          <TextField name="name" label="Nombre" required defaultValue={record?.name}
            placeholder="Ampliacion 4 canchas Madrid" />
          <div>
            <label htmlFor="status" className="label">Estado</label>
            <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}
              className="input cursor-pointer">
              {OPPORTUNITY_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <SelectField name="source" label="Origen" defaultValue={record?.source}
            options={LEAD_SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </FormGrid>
        <TextAreaField name="description" label="Descripcion" className="mt-4"
          defaultValue={record?.description} />
      </FormSection>

      <FormSection title="Valoracion"
        description="El pipeline ponderado del dashboard es el importe multiplicado por la probabilidad.">
        <FormGrid cols={3}>
          <MoneyField name="estimated_amount" label="Importe estimado" currency={currency}
            defaultValue={record?.estimated_amount} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <NumberField name="estimated_courts" label="Canchas estimadas" min={0}
            defaultValue={record?.estimated_courts ?? 0} />
          <NumberField name="probability" label="Probabilidad" min={0} max={100} suffix="%"
            defaultValue={record?.probability ?? 10} />
          <DateField name="expected_close_date" label="Cierre previsto"
            defaultValue={record?.expected_close_date} />
        </FormGrid>
      </FormSection>

      <FormSection title="Seguimiento"
        description="Una accion con fecha vencida genera alerta en el Control Center.">
        <FormGrid>
          <TextField name="next_action" label="Proxima accion" defaultValue={record?.next_action}
            placeholder="Enviar contrato revisado" />
          <DateField name="next_action_date" label="Fecha de la accion"
            defaultValue={record?.next_action_date} />
        </FormGrid>

        {status === 'PERDIDA' ? (
          <TextAreaField name="lost_reason" label="Motivo de la perdida" required rows={2}
            className="mt-4" defaultValue={record?.lost_reason}
            hint="Obligatorio: la base no admite una oportunidad perdida sin motivo." />
        ) : null}

        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
