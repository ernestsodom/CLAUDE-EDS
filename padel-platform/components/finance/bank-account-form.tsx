'use client';

import { saveBankAccount } from '@/actions/finance';
import { EntityForm } from '@/components/forms/entity-form';
import {
  CheckboxField, FormGrid, FormSection, MoneyField, SelectField, TextAreaField, TextField,
} from '@/components/forms';
import { CURRENCIES } from '@/lib/validations/finance';
import type { CurrencyCode } from '@/types/database.types';

export interface BankAccountRecord {
  id: string; name: string; bank_name: string | null; account_number: string | null;
  iban: string | null; swift: string | null; currency: string;
  opening_balance: number; active: boolean; notes: string | null;
}

export function BankAccountForm({
  projectCode, record, cancelHref, currency,
}: {
  projectCode: string; record: BankAccountRecord | null;
  cancelHref: string; currency: CurrencyCode;
}) {
  return (
    <EntityForm action={saveBankAccount} projectCode={projectCode} id={record?.id} cancelHref={cancelHref}>
      <FormSection title="Cuenta">
        <FormGrid>
          <TextField name="name" label="Nombre de la cuenta" required
            defaultValue={record?.name} placeholder="Cuenta operativa EUR" />
          <TextField name="bank_name" label="Banco" defaultValue={record?.bank_name} />
          <TextField name="iban" label="IBAN" defaultValue={record?.iban} />
          <TextField name="swift" label="SWIFT / BIC" defaultValue={record?.swift} />
          <TextField name="account_number" label="Numero de cuenta" defaultValue={record?.account_number} />
          <SelectField name="currency" label="Moneda" allowEmpty={false}
            defaultValue={record?.currency ?? currency}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <MoneyField name="opening_balance" label="Saldo inicial"
            currency={(record?.currency as CurrencyCode) ?? currency}
            defaultValue={record?.opening_balance} />
        </FormGrid>
        <div className="mt-4">
          <CheckboxField name="active" label="Cuenta activa" defaultChecked={record?.active ?? true} />
        </div>
        <TextAreaField name="notes" label="Notas" className="mt-4" defaultValue={record?.notes} />
      </FormSection>
    </EntityForm>
  );
}
