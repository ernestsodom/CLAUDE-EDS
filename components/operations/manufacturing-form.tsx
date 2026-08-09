'use client';

import { saveManufacturingProject } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { MANUFACTURING_STATUSES, PRIORITIES } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';

export interface ManufacturingRecord {
  id: string; name: string; description: string | null; sale_id: string | null;
  client_id: string | null; quantity_courts: number; start_date: string | null;
  estimated_completion_date: string | null; actual_completion_date: string | null;
  status: string; priority: string; notes: string | null;
}

export function ManufacturingForm({
  projectCode, record, cancelHref, clients, sales,
}: {
  projectCode: string; record: ManufacturingRecord | null; cancelHref: string;
  clients: Option[]; sales: Option[];
}) {
  return (
    <EntityForm action={saveManufacturingProject} projectCode={projectCode} id={record?.id}
      cancelHref={cancelHref}>
      <FormSection title="Proyecto de fabricacion"
        description="Al confirmar una venta se crea uno automaticamente; este formulario sirve para los que se planifican a mano.">
        <FormGrid>
          <TextField name="name" label="Nombre" required className="sm:col-span-2"
            defaultValue={record?.name} placeholder="Fabricacion EUROPA-2026-0001" />
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <SelectField name="client_id" label="Cliente" options={clients} defaultValue={record?.client_id} />
          <NumberField name="quantity_courts" label="Canchas a fabricar" min={0}
            defaultValue={record?.quantity_courts ?? 0} />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'PLANIFICACION'}
            options={MANUFACTURING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <SelectField name="priority" label="Prioridad" allowEmpty={false}
            defaultValue={record?.priority ?? 'MEDIA'}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
        </FormGrid>
      </FormSection>

      <FormSection title="Plazos"
        description="Si la fecha estimada vence sin terminar, se genera la alerta de fabricacion atrasada.">
        <FormGrid cols={3}>
          <DateField name="start_date" label="Inicio" defaultValue={record?.start_date} />
          <DateField name="estimated_completion_date" label="Fin estimado"
            defaultValue={record?.estimated_completion_date} />
          <DateField name="actual_completion_date" label="Fin real"
            defaultValue={record?.actual_completion_date} />
        </FormGrid>
        <TextAreaField name="description" label="Descripcion" className="mt-4"
          defaultValue={record?.description} />
        <TextAreaField name="notes" label="Notas" className="mt-4" rows={2} defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
