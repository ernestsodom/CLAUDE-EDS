'use client';

import { useState } from 'react';
import {
  DateField, FormGrid, MoneyField, NumberField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { EntityForm } from '@/components/forms/entity-form';
import { applyInvoiceExtraction } from '@/actions/ai';
import type { Option } from '@/lib/services/options';

/**
 * Aplicacion de una extraccion aprobada a una factura (§42).
 *
 * El formulario llega prerrellenado con lo que leyo la IA, pero lo que se
 * guarda es lo que hay en los campos al pulsar: si la persona corrige una
 * fecha o un importe, se guarda su correccion. El JSON del modelo queda
 * archivado en `ai_document_extractions` como evidencia, no como fuente.
 *
 * La factura nace en BORRADOR. Emitirla sigue siendo un acto deliberado.
 */
export function ApplyInvoiceForm({
  projectCode, extractionId, suggestion, clients, suppliers, sales,
}: {
  projectCode: string;
  extractionId: string;
  suggestion: Record<string, unknown>;
  clients: Option[];
  suppliers: Option[];
  sales: Option[];
}) {
  const text = (key: string) => {
    const value = suggestion[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const num = (key: string) => {
    const value = suggestion[key];
    return typeof value === 'number' ? value : undefined;
  };
  const isoDate = (key: string) => {
    const value = text(key);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  };

  const [kind, setKind] = useState<'VENTA' | 'COMPRA'>('COMPRA');

  const currency = (() => {
    const value = text('currency')?.toUpperCase();
    return value && ['EUR', 'USD', 'ARS', 'CLP'].includes(value) ? value : 'EUR';
  })();

  return (
    <EntityForm
      action={applyInvoiceExtraction}
      projectCode={projectCode}
      submitLabel="Crear factura en borrador"
      hidden={{ extraction_id: extractionId }}
    >
      <FormGrid>
        <div>
          <label className="label" htmlFor="apply-kind">
            Tipo de factura <span className="text-accent">*</span>
          </label>
          <select
            id="apply-kind" name="kind" className="input cursor-pointer" value={kind}
            onChange={(e) => setKind(e.target.value as 'VENTA' | 'COMPRA')}
          >
            <option value="COMPRA">Compra (la recibimos)</option>
            <option value="VENTA">Venta (la emitimos)</option>
          </select>
        </div>

        <TextField
          name="external_number" label="Numero del documento" required
          defaultValue={text('invoice_number')}
          hint="Tal como aparece en el papel. El numero interno lo asigna el sistema."
        />

        <DateField name="invoice_date" label="Fecha de factura" required
          defaultValue={isoDate('invoice_date')} />
        <DateField name="due_date" label="Vencimiento" defaultValue={isoDate('due_date')} />

        {kind === 'VENTA' ? (
          <SelectField name="client_id" label="Cliente" required options={clients}
            hint={text('recipient_name') ? `La IA leyo: ${text('recipient_name')}` : undefined} />
        ) : (
          <SelectField name="supplier_id" label="Proveedor" required options={suppliers}
            hint={text('issuer_name') ? `La IA leyo: ${text('issuer_name')}` : undefined} />
        )}

        <SelectField name="sale_id" label="Venta asociada" options={sales}
          hint="Opcional. Vincula el gasto o el ingreso al eje economico del negocio." />

        <SelectField
          name="currency" label="Moneda" required allowEmpty={false}
          defaultValue={currency}
          options={[
            { value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' },
            { value: 'ARS', label: 'ARS' }, { value: 'CLP', label: 'CLP' },
          ]}
        />

        <MoneyField
          name="subtotal" label="Base imponible" required
          defaultValue={num('subtotal') ?? num('total')}
          currency={currency as 'EUR'}
          hint={num('total') !== undefined ? `Total leido en el documento: ${num('total')}` : undefined}
        />

        <NumberField name="tax_rate" label="IVA" step="0.01" min={0} max={100} suffix="%"
          defaultValue={num('tax_rate') ?? 0} />
      </FormGrid>

      <TextAreaField name="notes" label="Notas" defaultValue={text('notes')} />
    </EntityForm>
  );
}
