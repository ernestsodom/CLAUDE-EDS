'use client';

import { saveExpense } from '@/actions/finance';
import { EntityForm } from '@/components/forms/entity-form';
import {
  DateField, FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES, EXPENSE_STATUSES } from '@/lib/validations/finance';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface ExpenseRecord {
  id: string; description: string; expense_date: string; amount: number;
  currency: string; status: string; cost_category_id: string | null;
  sale_id: string | null; supplier_id: string | null;
  bank_account_id: string | null; paid_at: string | null; notes: string | null;
}

export function ExpenseForm({
  projectCode, record, cancelHref, currency, categories, sales, suppliers, banks,
}: {
  projectCode: string; record: ExpenseRecord | null; cancelHref: string;
  currency: CurrencyCode;
  categories: Option[]; sales: Option[]; suppliers: Option[]; banks: Option[];
}) {
  return (
    <EntityForm action={saveExpense} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Gasto">
        <FormGrid>
          <TextField name="description" label="Concepto" required className="sm:col-span-2"
            defaultValue={record?.description} placeholder="Viaje comercial Madrid" />
          <DateField name="expense_date" label="Fecha" required
            defaultValue={record?.expense_date ?? new Date().toISOString().slice(0, 10)} />
          <MoneyField name="amount" label="Importe" required currency={currency}
            defaultValue={record?.amount} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <SelectField name="status" label="Estado" allowEmpty={false}
            defaultValue={record?.status ?? 'BORRADOR'}
            options={EXPENSE_STATUSES.map((s) => ({ value: s, label: s }))} />
        </FormGrid>
      </FormSection>

      <FormSection title="Imputacion"
        description="Asociar el gasto a una venta lo incorpora al margen real de esa operacion.">
        <FormGrid>
          <SelectField name="cost_category_id" label="Categoria de costo"
            defaultValue={record?.cost_category_id} options={categories} />
          <SelectField name="sale_id" label="Venta" defaultValue={record?.sale_id} options={sales}
            placeholder="Gasto general (sin venta)" />
          <SelectField name="supplier_id" label="Proveedor" defaultValue={record?.supplier_id} options={suppliers} />
          <SelectField name="bank_account_id" label="Cuenta bancaria" defaultValue={record?.bank_account_id} options={banks} />
          <DateField name="paid_at" label="Fecha de pago" defaultValue={record?.paid_at} />
        </FormGrid>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
