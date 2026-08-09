'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import {
  BankAccountSchema, ContractSchema, ExpenseSchema, InvoiceItemSchema,
  InvoiceSchema, PaymentSchema,
} from '@/lib/validations/finance';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

type FormState = ActionResult<{ id: string }> | null;

function context(formData: FormData) {
  return {
    projectCode: String(formData.get('projectCode') ?? ''),
    id: formData.get('id') ? String(formData.get('id')) : null,
  };
}

// =====================================================================
// Facturas
//
// El formulario NO envia subtotal, tax ni total: los calcula un trigger a
// partir de `invoice_items`. Tampoco `paid_amount`, que se deriva de los
// pagos. Enviarlos desde el cliente permitiria que cabecera y detalle
// dejaran de cuadrar.
// =====================================================================
export async function saveInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'invoices',
    module: 'invoices',
    id,
    schema: InvoiceSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/finanzas/facturas`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/finanzas/facturas/${result.data.id}`);
  if (result.ok && id) revalidatePath(`/${projectCode}/finanzas/facturas/${id}`);
  return result;
}

export async function deleteInvoice(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'invoices', id, module: 'invoices',
    revalidate: [`/${projectCode}/finanzas/facturas`],
  });
}

export async function saveInvoiceItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const invoiceId = String(formData.get('invoice_id') ?? '');

  return persistRecord({
    projectCode,
    table: 'invoice_items',
    module: 'invoices',
    id,
    schema: InvoiceItemSchema,
    raw: formToObject(formData),
    stamp: {},
    extra: { invoice_id: invoiceId },
    revalidate: [`/${projectCode}/finanzas/facturas/${invoiceId}`],
    successMessage: 'Linea guardada.',
  });
}

/**
 * Las lineas de factura si se borran fisicamente: no son el documento
 * legal, solo su detalle en construccion. El trigger recalcula el total.
 */
export async function deleteInvoiceItem(
  projectCode: string, id: string, invoiceId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'invoices.update')) {
    return failure('No tienes permiso para modificar facturas.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('invoice_items').delete().eq('id', id);
  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/finanzas/facturas/${invoiceId}`);
  return success(null, 'Linea eliminada.');
}

// =====================================================================
// Pagos
// =====================================================================
export async function savePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);
  const invoiceId = formData.get('invoice_id') ? String(formData.get('invoice_id')) : null;

  const result = await persistRecord({
    projectCode,
    table: 'payments',
    module: 'payments',
    id,
    schema: PaymentSchema,
    raw: formToObject(formData),
    revalidate: [
      `/${projectCode}/finanzas/pagos`,
      `/${projectCode}/finanzas/facturas`,
      `/${projectCode}/dashboard`,
      ...(invoiceId ? [`/${projectCode}/finanzas/facturas/${invoiceId}`] : []),
    ],
    successMessage: 'Pago registrado. El saldo de la factura se ha actualizado.',
  });

  if (result.ok && !id) redirect(`/${projectCode}/finanzas/pagos`);
  return result;
}

export async function deletePayment(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'payments', id, module: 'payments',
    revalidate: [`/${projectCode}/finanzas/pagos`, `/${projectCode}/finanzas/facturas`],
  });
}

// =====================================================================
// Contratos
// =====================================================================
export async function saveContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'contracts',
    module: 'contracts',
    id,
    schema: ContractSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/finanzas/contratos`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/finanzas/contratos`);
  return result;
}

export async function deleteContract(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'contracts', id, module: 'contracts',
    revalidate: [`/${projectCode}/finanzas/contratos`],
  });
}

// =====================================================================
// Gastos
// =====================================================================
export async function saveExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'expenses',
    module: 'expenses',
    id,
    schema: ExpenseSchema,
    raw: formToObject(formData),
    revalidate: [`/${projectCode}/finanzas/gastos`, `/${projectCode}/dashboard`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/finanzas/gastos`);
  return result;
}

export async function deleteExpense(projectCode: string, id: string): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'expenses', id, module: 'expenses',
    revalidate: [`/${projectCode}/finanzas/gastos`],
  });
}

// =====================================================================
// Cuentas bancarias
// =====================================================================
export async function saveBankAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const { projectCode, id } = context(formData);

  const result = await persistRecord({
    projectCode,
    table: 'bank_accounts',
    module: 'banks',
    id,
    schema: BankAccountSchema,
    raw: formToObject(formData, { booleans: ['active'] }),
    stamp: {},
    revalidate: [`/${projectCode}/finanzas/bancos`],
  });

  if (result.ok && !id) redirect(`/${projectCode}/finanzas/bancos`);
  return result;
}

export async function deleteBankAccount(
  projectCode: string, id: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'bank_accounts', id, module: 'banks',
    revalidate: [`/${projectCode}/finanzas/bancos`],
  });
}
