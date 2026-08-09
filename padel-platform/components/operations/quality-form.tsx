'use client';

import { saveQualityCheck } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField,
} from '@/components/forms';
import { QUALITY_RESULTS } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';

export interface QualityRecord {
  id: string; check_type: string; check_date: string; manufacturing_project_id: string | null;
  court_id: string | null; installation_id: string | null; result: string;
  score: number | null; observations: string | null; corrective_actions: string | null;
}

const CHECK_TYPES = ['FABRICACION', 'GALVANIZADO', 'EMBALAJE', 'INSTALACION'];

export function QualityForm({
  projectCode, record, cancelHref, courts, manufacturing, installations,
}: {
  projectCode: string; record: QualityRecord | null; cancelHref: string;
  courts: Option[]; manufacturing: Option[]; installations: Option[];
}) {
  return (
    <EntityForm action={saveQualityCheck} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Control de calidad"
        description="Indica al menos uno de los tres objetivos: cancha, fabricacion o instalacion.">
        <FormGrid>
          <SelectField name="check_type" label="Tipo de control" allowEmpty={false}
            defaultValue={record?.check_type ?? 'FABRICACION'}
            options={CHECK_TYPES.map((t) => ({ value: t, label: t }))} />
          <DateField name="check_date" label="Fecha" required
            defaultValue={record?.check_date ?? new Date().toISOString().slice(0, 10)} />
          <SelectField name="court_id" label="Cancha" options={courts} defaultValue={record?.court_id} />
          <SelectField name="manufacturing_project_id" label="Proyecto de fabricacion"
            options={manufacturing} defaultValue={record?.manufacturing_project_id} />
          <SelectField name="installation_id" label="Instalacion" options={installations}
            defaultValue={record?.installation_id} />
          <SelectField name="result" label="Resultado" allowEmpty={false}
            defaultValue={record?.result ?? 'PENDIENTE'}
            options={QUALITY_RESULTS.map((r) => ({ value: r, label: r }))} />
          <NumberField name="score" label="Puntuacion" min={0} max={100} suffix="/100"
            defaultValue={record?.score} />
        </FormGrid>
        <TextAreaField name="observations" label="Observaciones" className="mt-4"
          defaultValue={record?.observations} />
        <TextAreaField name="corrective_actions" label="Acciones correctivas" className="mt-4" rows={2}
          defaultValue={record?.corrective_actions} />
      </FormSection>
    </EntityForm>
  );
}
