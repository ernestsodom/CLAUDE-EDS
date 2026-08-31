'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { saveDeal } from '@/actions/deals';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { DEAL_STATUSES, isClosedStatus } from '@/lib/validations/deals';
import type { Deal } from '@/types/database.types';

/**
 * Alta y edicion de un negocio.
 *
 * El formulario refleja la regla del negocio en lugar de explicarla: las
 * fechas de cierre y entrega solo aparecen cuando el estado dice que la
 * venta esta cerrada. Asi no hay forma de teclear una fecha de entrega
 * para un negocio que aun se esta negociando.
 */
export function DealForm({
  projectCode,
  record,
  cancelHref,
}: {
  projectCode: string;
  record: Deal | null;
  cancelHref: string;
}) {
  const [status, setStatus] = useState<string>(record?.status ?? 'POTENCIAL');
  const closed = isClosedStatus(status);

  return (
    <EntityForm action={saveDeal} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Cliente">
        <FormGrid>
          <TextField
            name="client_name" label="Club o cliente" required
            defaultValue={record?.client_name} placeholder="Club Rosario Padel"
          />
          <TextField name="contact_name" label="Persona de contacto" defaultValue={record?.contact_name} />
          <TextField name="contact_email" label="Email" type="email" defaultValue={record?.contact_email} />
          <TextField name="contact_phone" label="Telefono" type="tel" defaultValue={record?.contact_phone} />
          <TextField
            name="city" label="Ciudad" defaultValue={record?.city} placeholder="Rosario"
          />
          <TextField
            name="country" label="Pais (ISO 2)" maxLength={2}
            defaultValue={record?.country} placeholder="AR"
          />
        </FormGrid>
      </FormSection>

      <FormSection
        title="Estado y comision"
        description="La comision por cancha se propone al anadir cada cancha; despues puede ajustarse una a una."
      >
        <FormGrid>
          <div>
            <label htmlFor="deal-status" className="label">
              Estado <span className="ml-1 text-accent">*</span>
            </label>
            <select
              id="deal-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input cursor-pointer"
            >
              {DEAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <NumberField
            name="commission_per_court_usd" label="Comision por cancha" step="0.01" min={0}
            suffix="USD" defaultValue={record?.commission_per_court_usd ?? 1700}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Fechas">
        <FormGrid cols={3}>
          <DateField name="opened_at" label="Alta del negocio" defaultValue={record?.opened_at} />
          <DateField
            name="expected_close_date" label="Cierre estimado"
            defaultValue={record?.expected_close_date}
          />

          {closed ? (
            <>
              <DateField
                name="closed_at" label="Cierre real" required defaultValue={record?.closed_at}
              />
              <DateField
                name="delivery_date" label="Fecha de entrega" defaultValue={record?.delivery_date}
                hint="Comprometida con el cliente."
              />
            </>
          ) : (
            <div className="sm:col-span-2 lg:col-span-1 flex items-start gap-2 self-end rounded border border-line bg-elevated/40 px-3 py-2.5 text-2xs text-content-muted">
              <Lock size={13} className="mt-0.5 shrink-0" />
              <span>
                La fecha de entrega se habilita al marcar el negocio como <b>CERRADA</b>. Sin venta
                cerrada no se compromete entrega.
              </span>
            </div>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Notas">
        {status === 'PERDIDA' ? (
          <TextField
            name="lost_reason" label="Motivo de la perdida" defaultValue={record?.lost_reason}
            placeholder="Precio, plazo, competencia..."
          />
        ) : null}
        <TextAreaField
          name="notes" label="Notas del negocio" rows={4} defaultValue={record?.notes}
          placeholder="Acuerdos, condiciones, siguiente paso..."
        />
      </FormSection>
    </EntityForm>
  );
}
