'use client';

import { useState } from 'react';
import { saveCourt } from '@/actions/operations';
import { EntityForm } from '@/components/forms/entity-form';
import {
  CheckboxField, FormGrid, FormSection, MoneyField, NumberField, SelectField,
  TextAreaField, TextField,
} from '@/components/forms';
import { humanize } from '@/lib/format';
import {
  COURT_STATUSES_NEW, COURT_STATUSES_USED, CURRENCIES, PHYSICAL_CONDITIONS,
} from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface CourtRecord {
  id: string; court_number: string; serial_number: string | null; model: string | null;
  court_type: string; year: number | null; status: string; sale_id: string | null;
  manufacturing_project_id: string | null; client_id: string | null;
  current_location: string | null; country: string | null; city: string | null;
  purchase_cost: number | null; refurbishment_cost: number | null; sale_price: number | null;
  currency: string; physical_condition: string | null; dimensions: string | null;
  glass_thickness_mm: number | null; has_lighting: boolean; notes: string | null;
}

/**
 * Alta y edicion de cancha.
 *
 * Los estados ofrecidos dependen del tipo, igual que el CHECK de la base:
 * mostrar opciones que PostgreSQL va a rechazar solo produce errores.
 */
export function CourtForm({
  projectCode, record, cancelHref, currency, defaultType, clients, sales, manufacturing,
}: {
  projectCode: string; record: CourtRecord | null; cancelHref: string;
  currency: CurrencyCode; defaultType: 'NUEVA' | 'USADA';
  clients: Option[]; sales: Option[]; manufacturing: Option[];
}) {
  const [courtType, setCourtType] = useState(record?.court_type ?? defaultType);
  const statuses = courtType === 'USADA' ? COURT_STATUSES_USED : COURT_STATUSES_NEW;
  const isUsed = courtType === 'USADA';

  return (
    <EntityForm action={saveCourt} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Identificacion">
        <FormGrid>
          <TextField name="court_number" label="Numero de cancha" defaultValue={record?.court_number}
            hint="Si lo dejas vacio se genera automaticamente (EUROPA-0023)." />
          <TextField name="serial_number" label="Numero de serie" defaultValue={record?.serial_number} />
          <TextField name="model" label="Modelo" defaultValue={record?.model} placeholder="PANORAMICA-PRO" />
          <div>
            <label htmlFor="court_type" className="label">
              Tipo <span className="ml-1 text-accent">*</span>
            </label>
            <select id="court_type" name="court_type" value={courtType}
              onChange={(e) => setCourtType(e.target.value)} className="input cursor-pointer">
              <option value="NUEVA">Nueva</option>
              <option value="USADA">Usada</option>
            </select>
          </div>
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? statuses[0]}
            options={statuses.map((s) => ({ value: s, label: humanize(s) }))}
            key={courtType} />
          <NumberField name="year" label="Ano" min={1980} max={2100} defaultValue={record?.year} />
        </FormGrid>
      </FormSection>

      <FormSection title="Relaciones">
        <FormGrid cols={3}>
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <SelectField name="manufacturing_project_id" label="Proyecto de fabricacion"
            options={manufacturing} defaultValue={record?.manufacturing_project_id} />
          <SelectField name="client_id" label="Cliente" options={clients} defaultValue={record?.client_id} />
        </FormGrid>
      </FormSection>

      <FormSection title="Caracteristicas y ubicacion">
        <FormGrid cols={3}>
          <SelectField name="physical_condition" label="Condicion" defaultValue={record?.physical_condition}
            options={PHYSICAL_CONDITIONS.map((c) => ({ value: c, label: humanize(c) }))} />
          <TextField name="dimensions" label="Dimensiones" defaultValue={record?.dimensions}
            placeholder="20x10 m" />
          <NumberField name="glass_thickness_mm" label="Espesor vidrio" suffix="mm" min={0}
            defaultValue={record?.glass_thickness_mm} />
          <TextField name="current_location" label="Ubicacion actual" defaultValue={record?.current_location}
            placeholder="Almacen Madrid" />
          <TextField name="city" label="Ciudad" defaultValue={record?.city} />
          <TextField name="country" label="Pais (ISO 2)" maxLength={2} defaultValue={record?.country} />
        </FormGrid>
        <div className="mt-4">
          <CheckboxField name="has_lighting" label="Incluye iluminacion"
            defaultChecked={record?.has_lighting ?? false} />
        </div>
      </FormSection>

      <FormSection title="Economia de la unidad"
        description={isUsed
          ? 'En canchas usadas, el margen se calcula como precio menos compra, reacondicionamiento y costos imputados.'
          : 'Opcional en canchas nuevas: el costo real se sigue por la venta, no por unidad.'}>
        <FormGrid cols={3}>
          <MoneyField name="purchase_cost" label="Costo de compra" currency={currency}
            defaultValue={record?.purchase_cost} />
          <MoneyField name="refurbishment_cost" label="Reacondicionamiento" currency={currency}
            defaultValue={record?.refurbishment_cost} />
          <MoneyField name="sale_price" label="Precio de venta" currency={currency}
            defaultValue={record?.sale_price} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
