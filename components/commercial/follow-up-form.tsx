'use client';

import { saveFollowUp } from '@/actions/crm';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { FOLLOW_UP_STATUSES, PRIORITIES } from '@/lib/validations/commercial';
import type { Option } from '@/lib/services/options';

export interface FollowUpRecord {
  id: string; client_id: string | null; opportunity_id: string | null;
  title: string; description: string | null; due_date: string;
  priority: string; status: string; result: string | null;
}

export function FollowUpForm({
  projectCode, record, cancelHref, clients, opportunities,
}: {
  projectCode: string; record: FollowUpRecord | null; cancelHref: string;
  clients: Option[]; opportunities: Option[];
}) {
  return (
    <EntityForm action={saveFollowUp} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Seguimiento"
        description="Si la fecha vence sin completarse, el motor de alertas lo marca como vencido.">
        <FormGrid>
          <TextField name="title" label="Titulo" required className="sm:col-span-2"
            defaultValue={record?.title} placeholder="Llamar a Racket Club Lyon" />
          <SelectField name="client_id" label="Cliente" options={clients}
            defaultValue={record?.client_id} />
          <SelectField name="opportunity_id" label="Oportunidad" options={opportunities}
            defaultValue={record?.opportunity_id} />
          <DateField name="due_date" label="Vence el" required
            defaultValue={record?.due_date ?? new Date().toISOString().slice(0, 10)} />
          <SelectField name="priority" label="Prioridad" allowEmpty={false}
            defaultValue={record?.priority ?? 'MEDIA'}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PENDIENTE'}
            options={FOLLOW_UP_STATUSES.map((s) => ({ value: s, label: s }))} />
        </FormGrid>
        <TextAreaField name="description" label="Descripcion" className="mt-4"
          defaultValue={record?.description} />
        {record ? (
          <TextAreaField name="result" label="Resultado" className="mt-4" rows={2}
            defaultValue={record?.result} />
        ) : null}
      </FormSection>
    </EntityForm>
  );
}
