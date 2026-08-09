'use client';

import { useState } from 'react';
import { savePayment } from '@/actions/finance';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/validations/finance';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface PaymentRecord {
  id: string; direction: string; payment_date: string; amount: number; currency: string;
  method: string; reference: string | null; invoice_id: string | null; sale_id: string | null;
  client_id: string | null; supplier_id: string | null; bank_account_id: string | null;
  notes: string | null;
}

/**
 * Registro de cobro o pago.
 *
 * La direccion cambia la contraparte y las facturas ofrecidas: un cobro se
 * asocia a un cliente y a una factura de venta; un pago, a un proveedor y a
 * una de compra. Mostrar ambas listas a la vez invita a cruzarlas mal.
 */
export function PaymentForm({
  projectCode, record, cancelHref, currency,
  clients, suppliers, banks, salesInvoices, purchaseInvoices, sales,
}: {
  projectCode: string; record: PaymentRecord | null; cancelHref: string; currency: CurrencyCode;
  clients: Option[]; suppliers: Option[]; banks: Option[];
  salesInvoices: Option[]; purchaseInvoices: Option[]; sales: Option[];
}) {
  const [direction, setDirection] = useState(record?.direction ?? 'ENTRADA');
  const isIncoming = direction === 'ENTRADA';

  return (
    <EntityForm action={savePayment} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Movimiento">
        <FormGrid>
          <div>
            <label htmlFor="direction" className="label">
              Tipo <span className="ml-1 text-accent">*</span>
            </label>
            <select id="direction" name="direction" value={direction}
              onChange={(e) => setDirection(e.target.value)} className="input cursor-pointer">
              <option value="ENTRADA">Cobro (entrada)</option>
              <option value="SALIDA">Pago (salida)</option>
            </select>
          </div>
          <DateField name="payment_date" label="Fecha" required
            defaultValue={record?.payment_date ?? new Date().toISOString().slice(0, 10)} />
          <MoneyField name="amount" label="Importe" required currency={currency} defaultValue={record?.amount} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <SelectField name="method" label="Metodo" allowEmpty={false}
            defaultValue={record?.method ?? 'TRANSFERENCIA'}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace(/_/g, ' ') }))} />
          <TextField name="reference" label="Referencia" defaultValue={record?.reference}
            placeholder="ANTICIPO 30%" />
        </FormGrid>
      </FormSection>

      <FormSection title="Aplicacion"
        description="Al asociar el pago a una factura, su saldo y su estado se recalculan solos.">
        <FormGrid>
          {isIncoming ? (
            <>
              <SelectField name="invoice_id" label="Factura de venta" options={salesInvoices}
                defaultValue={record?.invoice_id} />
              <SelectField name="client_id" label="Cliente" options={clients}
                defaultValue={record?.client_id} />
            </>
          ) : (
            <>
              <SelectField name="invoice_id" label="Factura de compra" options={purchaseInvoices}
                defaultValue={record?.invoice_id} />
              <SelectField name="supplier_id" label="Proveedor" options={suppliers}
                defaultValue={record?.supplier_id} />
            </>
          )}
          <SelectField name="sale_id" label="Venta" options={sales} defaultValue={record?.sale_id} />
          <SelectField name="bank_account_id" label="Cuenta bancaria" options={banks}
            defaultValue={record?.bank_account_id} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
