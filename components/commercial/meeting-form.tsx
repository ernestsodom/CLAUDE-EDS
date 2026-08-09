'use client';

import { saveMeeting } from '@/actions/crm';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { MEETING_STATUSES, MEETING_TYPES } from '@/lib/validations/commercial';
import type { Option } from '@/lib/services/options';

export interface MeetingRecord {
  id: string; client_id: string | null; opportunity_id: string | null;
  meeting_date: string; start_time: string | null; end_time: string | null;
  location: string | null; meeting_type: string; status: string;
  objective: string | null; summary: string | null; agreements: string | null;
  next_steps: string | null; next_followup_date: string | null;
}

export function MeetingForm({
  projectCode, record, cancelHref, clients, opportunities,
}: {
  projectCode: string; record: MeetingRecord | null; cancelHref: string;
  clients: Option[]; opportunities: Option[];
}) {
  return (
    <EntityForm action={saveMeeting} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Reunion">
        <FormGrid>
          <SelectField name="client_id" label="Cliente" options={clients} defaultValue={record?.client_id} />
          <SelectField name="opportunity_id" label="Oportunidad" options={opportunities}
            defaultValue={record?.opportunity_id} />
          <DateField name="meeting_date" label="Fecha" required
            defaultValue={record?.meeting_date ?? new Date().toISOString().slice(0, 10)} />
          <SelectField name="meeting_type" label="Tipo" allowEmpty={false}
            defaultValue={record?.meeting_type ?? 'VIDEOLLAMADA'}
            options={MEETING_TYPES.map((t) => ({ value: t, label: t }))} />
          <div>
            <label htmlFor="start_time" className="label">Hora de inicio</label>
            <input id="start_time" name="start_time" type="time"
              defaultValue={record?.start_time?.slice(0, 5) ?? ''} className="input" />
          </div>
          <div>
            <label htmlFor="end_time" className="label">Hora de fin</label>
            <input id="end_time" name="end_time" type="time"
              defaultValue={record?.end_time?.slice(0, 5) ?? ''} className="input" />
          </div>
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PLANIFICADA'}
            options={MEETING_STATUSES.map((s) => ({ value: s, label: s }))} />
          <TextField name="location" label="Lugar" defaultValue={record?.location} />
        </FormGrid>
        <TextAreaField name="objective" label="Objetivo" className="mt-4" rows={2}
          defaultValue={record?.objective} />
      </FormSection>

      <FormSection title="Resultado" description="Se rellena despues de la reunion.">
        <div className="space-y-4">
          <TextAreaField name="summary" label="Resumen" rows={3} defaultValue={record?.summary} />
          <TextAreaField name="agreements" label="Acuerdos" rows={2} defaultValue={record?.agreements} />
          <TextAreaField name="next_steps" label="Proximos pasos" rows={2} defaultValue={record?.next_steps} />
          <DateField name="next_followup_date" label="Proximo seguimiento"
            defaultValue={record?.next_followup_date} />
        </div>
      </FormSection>
    </EntityForm>
  );
}
