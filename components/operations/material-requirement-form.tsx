'use client';

import { saveMaterialRequirement } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField,
} from '@/components/forms';
import type { Option } from '@/lib/services/options';

export interface MaterialRequirementRecord {
  id: string; manufacturing_project_id: string; material_id: string;
  sale_id: string | null; court_id: string | null;
  quantity_required: number; quantity_available: number; quantity_purchased: number;
  needed_by_date: string | null; estimated_unit_cost: number; notes: string | null;
}

export function MaterialRequirementForm({
  projectCode, record, cancelHref, materials, manufacturing, sales,
}: {
  projectCode: string; record: MaterialRequirementRecord | null; cancelHref: string;
  materials: Option[]; manufacturing: Option[]; sales: Option[];
}) {
  return (
    <EntityForm action={saveMaterialRequirement} projectCode={projectCode} id={record?.id}
      cancelHref={cancelHref}>
      <FormSection title="Requerimiento de material"
        description="El faltante se calcula como requerido menos disponible menos comprado, y nunca es negativo.">
        <FormGrid>
          <SelectField name="manufacturing_project_id" label="Proyecto de fabricacion" required
            options={manufacturing} defaultValue={record?.manufacturing_project_id} />
          <SelectField name="material_id" label="Material" required options={materials}
            defaultValue={record?.material_id} />
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <DateField name="needed_by_date" label="Necesario para" defaultValue={record?.needed_by_date} />
        </FormGrid>
      </FormSection>

      <FormSection title="Cantidades">
        <FormGrid cols={3}>
          <NumberField name="quantity_required" label="Requerido" step="0.001" min={0}
            defaultValue={record?.quantity_required ?? 0} />
          <NumberField name="quantity_available" label="Disponible" step="0.001" min={0}
            defaultValue={record?.quantity_available ?? 0} />
          <NumberField name="quantity_purchased" label="Comprado" step="0.001" min={0}
            defaultValue={record?.quantity_purchased ?? 0} />
          <NumberField name="estimated_unit_cost" label="Costo unitario estimado" step="0.0001" min={0}
            defaultValue={record?.estimated_unit_cost ?? 0} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" rows={2} defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
