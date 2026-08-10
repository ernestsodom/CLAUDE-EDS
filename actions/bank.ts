'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { downloadObject, removeObject } from '@/lib/services/storage';
import {
  guessMapping, normalizeStatement, readStatementFile,
  type ColumnMapping, type ParseIssue,
} from '@/lib/services/bank-import';
import {
  BankImportMappingSchema, BankImportSchema,
} from '@/lib/validations/documents';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

/**
 * Conciliacion bancaria (FASE 9b).
 *
 * La importacion tiene dos pasos a proposito:
 *
 *   `previewBankStatement` lee el fichero y devuelve sus cabeceras, un
 *   mapeo propuesto y las primeras filas ya interpretadas. Nadie importa
 *   a ciegas: se ve lo que va a entrar antes de que entre.
 *
 *   `importBankStatement` inserta. Es idempotente: `import_hash` tiene
 *   indice unico por cuenta, asi que reimportar el mismo extracto —o un
 *   extracto que solape con el anterior— no duplica ni un movimiento.
 *
 * El fichero llega por Storage, no por el cuerpo de la Server Action:
 * evita el limite de payload y deja el extracto original archivado, que
 * es exactamente lo que pide una auditoria cuando el banco y la
 * contabilidad no cuadran.
 */

export interface StatementPreview {
  headers: string[];
  mapping: Partial<ColumnMapping>;
  sample: {
    transaction_date: string; amount: number;
    description: string | null; reference: string | null;
  }[];
  detected: number;
  issues: ParseIssue[];
  rowCount: number;
}

async function readFromStorage(
  bucket: string,
  path: string,
  fileName: string,
): Promise<{ ok: true; rows: string[][] } | { ok: false; error: string }> {
  const file = await downloadObject(bucket, path);
  if (!file.ok) return { ok: false, error: file.error };

  try {
    return { ok: true, rows: readStatementFile(fileName, file.bytes) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo leer el archivo.',
    };
  }
}

// =====================================================================
// 1) Vista previa
// =====================================================================
export async function previewBankStatement(input: {
  projectCode: string;
  bucket: string;
  path: string;
  fileName: string;
  mapping?: Partial<ColumnMapping>;
  decimal?: 'COMMA' | 'DOT';
  dateOrder?: 'DMY' | 'MDY' | 'YMD';
  invertSign?: boolean;
}): Promise<ActionResult<StatementPreview>> {
  const { project } = await requireProject(input.projectCode);
  if (!can(project, 'banks.view')) {
    return failure('No tienes permiso para consultar bancos en este proyecto.');
  }

  const read = await readFromStorage(input.bucket, input.path, input.fileName);
  if (!read.ok) return failure(read.error);

  const headers = read.rows[0]?.map((h) => h.trim()) ?? [];
  const proposed = { ...guessMapping(headers), ...(input.mapping ?? {}) };

  if (!proposed.date || (!proposed.amount && !proposed.credit && !proposed.debit)) {
    return success({
      headers,
      mapping: proposed,
      sample: [],
      detected: 0,
      rowCount: Math.max(read.rows.length - 1, 0),
      issues: [{
        row: 0,
        reason: 'No he reconocido las columnas de fecha e importe. Indicalas manualmente.',
      }],
    });
  }

  const parsed = normalizeStatement(
    read.rows,
    proposed as ColumnMapping,
    {
      decimal: input.decimal ?? 'COMMA',
      dateOrder: input.dateOrder ?? 'DMY',
      invertSign: input.invertSign ?? false,
    },
  );

  return success({
    headers,
    mapping: proposed,
    detected: parsed.transactions.length,
    rowCount: parsed.rowCount,
    issues: parsed.issues.slice(0, 20),
    sample: parsed.transactions.slice(0, 10).map((t) => ({
      transaction_date: t.transaction_date,
      amount: t.amount,
      description: t.description,
      reference: t.reference,
    })),
  });
}

// =====================================================================
// 2) Importacion
// =====================================================================
export interface ImportOutcome {
  batchId: string;
  inserted: number;
  duplicates: number;
  failed: number;
  rowCount: number;
  issues: ParseIssue[];
}

export async function importBankStatement(input: {
  projectCode: string;
  bankAccountId: string;
  bucket: string;
  path: string;
  fileName: string;
  mapping: ColumnMapping;
  decimal: 'COMMA' | 'DOT';
  dateOrder: 'DMY' | 'MDY' | 'YMD';
  invertSign: boolean;
}): Promise<ActionResult<ImportOutcome>> {
  const { project, session } = await requireProject(input.projectCode);
  if (!can(project, 'banks.create')) {
    return failure('No tienes permiso para importar movimientos en este proyecto.');
  }

  const options = BankImportSchema.safeParse({
    bank_account_id: input.bankAccountId,
    decimal: input.decimal,
    date_order: input.dateOrder,
    invert_sign: input.invertSign,
  });
  if (!options.success) return failure(options.error.issues[0]?.message ?? 'Datos invalidos');

  const mapping = BankImportMappingSchema.safeParse(input.mapping);
  if (!mapping.success) return failure(mapping.error.issues[0]?.message ?? 'Mapeo invalido');

  const supabase = await createClient();

  // La cuenta tiene que ser de este proyecto. RLS ya lo impondria en el
  // insert, pero fallar aqui da un mensaje que se entiende.
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id, currency')
    .eq('id', input.bankAccountId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!account) return failure('La cuenta bancaria no existe en esta unidad de negocio.');

  const read = await readFromStorage(input.bucket, input.path, input.fileName);
  if (!read.ok) return failure(read.error);

  const parsed = normalizeStatement(read.rows, mapping.data as ColumnMapping, {
    decimal: options.data.decimal,
    dateOrder: options.data.date_order,
    invertSign: options.data.invert_sign,
  });

  if (parsed.transactions.length === 0) {
    return failure(
      parsed.issues[0]?.reason ?? 'No he encontrado ningun movimiento legible en el archivo.',
    );
  }

  const dates = parsed.transactions.map((t) => t.transaction_date).sort();

  const { data: batch, error: batchError } = await supabase
    .from('bank_import_batches')
    .insert({
      project_id: project.id,
      bank_account_id: input.bankAccountId,
      file_name: input.fileName,
      file_format: input.fileName.toLowerCase().endsWith('.csv') ? 'CSV' : 'XLSX',
      row_count: parsed.rowCount,
      error_count: parsed.issues.length,
      period_from: dates[0],
      period_to: dates[dates.length - 1],
      imported_by: session.user?.id ?? null,
    })
    .select('id')
    .single();

  if (batchError || !batch) return failure(toUserMessage(batchError?.message ?? ''));

  // Los movimientos ya presentes se ignoran por el indice unico
  // (bank_account_id, import_hash): eso es lo que hace que reimportar sea
  // seguro. `ignoreDuplicates` evita ademas pisar una conciliacion ya
  // hecha con los datos crudos del banco.
  const payload = parsed.transactions.map((t) => ({
    project_id: project.id,
    bank_account_id: input.bankAccountId,
    transaction_date: t.transaction_date,
    value_date: t.value_date,
    transaction_type: t.amount >= 0 ? 'INGRESO' : 'EGRESO',
    description: t.description,
    counterparty: t.counterparty,
    reference: t.reference,
    amount: t.amount,
    currency: account.currency,
    balance_after: t.balance_after,
    import_batch_id: batch.id,
    import_hash: t.import_hash,
  }));

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(chunk, {
        onConflict: 'bank_account_id,import_hash',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      await supabase.from('bank_import_batches')
        .update({ inserted_count: inserted, notes: `Interrumpida: ${error.message}` })
        .eq('id', batch.id);
      return failure(toUserMessage(error.message));
    }
    inserted += data?.length ?? 0;
  }

  const duplicates = parsed.transactions.length - inserted;

  await supabase.from('bank_import_batches')
    .update({ inserted_count: inserted, duplicate_count: duplicates })
    .eq('id', batch.id);

  revalidatePath(`/${input.projectCode}/finanzas/bancos`);
  revalidatePath(`/${input.projectCode}/finanzas/bancos/conciliacion`);

  return success(
    {
      batchId: batch.id,
      inserted,
      duplicates,
      failed: parsed.issues.length,
      rowCount: parsed.rowCount,
      issues: parsed.issues.slice(0, 20),
    },
    duplicates > 0
      ? `${inserted} movimientos nuevos. ${duplicates} ya estaban importados y se han ignorado.`
      : `${inserted} movimientos importados.`,
  );
}

/** Deshace una subida a medias: el extracto no llego a importarse. */
export async function discardStatementFile(
  projectCode: string,
  bucket: string,
  path: string,
): Promise<ActionResult<null>> {
  await requireProject(projectCode);
  await removeObject(bucket, path);
  return success(null);
}

// =====================================================================
// 3) Conciliacion
// =====================================================================
export interface MatchCandidate {
  kind: 'PAYMENT' | 'EXPENSE';
  id: string;
  entity_date: string;
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  score: number;
}

export async function getMatchCandidates(
  projectCode: string,
  transactionId: string,
): Promise<ActionResult<MatchCandidate[]>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'banks.view')) return failure('No tienes permiso para ver bancos.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('bank_match_candidates', {
    p_transaction_id: transactionId,
  });

  if (error) return failure(toUserMessage(error.message));
  return success((data ?? []) as MatchCandidate[]);
}

/**
 * Conciliar.
 *
 * La comprobacion real —mismo proyecto, misma direccion del dinero, mismo
 * importe, y un pago conciliado como mucho una vez— la hace
 * `public.reconcile_bank_transaction` en PostgreSQL. Aqui solo se traduce
 * el error al idioma del negocio.
 */
export async function reconcileTransaction(input: {
  projectCode: string;
  transactionId: string;
  kind: 'PAYMENT' | 'EXPENSE';
  targetId: string;
}): Promise<ActionResult<null>> {
  const { project } = await requireProject(input.projectCode);
  if (!can(project, 'banks.update')) {
    return failure('No tienes permiso para conciliar en este proyecto.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reconcile_bank_transaction', {
    p_transaction_id: input.transactionId,
    p_payment_id: input.kind === 'PAYMENT' ? input.targetId : null,
    p_expense_id: input.kind === 'EXPENSE' ? input.targetId : null,
  });

  if (error) return failure(reconciliationMessage(error.message));

  revalidatePath(`/${input.projectCode}/finanzas/bancos/conciliacion`);
  return success(null, 'Movimiento conciliado.');
}

export async function unreconcileTransaction(
  projectCode: string,
  transactionId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'banks.update')) {
    return failure('No tienes permiso para modificar conciliaciones.');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('unreconcile_bank_transaction', {
    p_transaction_id: transactionId,
  });

  if (error) return failure(reconciliationMessage(error.message));

  revalidatePath(`/${projectCode}/finanzas/bancos/conciliacion`);
  return success(null, 'Conciliacion deshecha.');
}

/**
 * Los mensajes de la funcion SQL ya estan escritos para una persona: se
 * dejan pasar tal cual y solo se traduce lo que sigue siendo tecnico.
 */
function reconciliationMessage(raw: string): string {
  const known = [
    'ya esta conciliado', 'ya esta conciliada', 'El importe no coincide',
    'direccion no coincide', 'Indica exactamente un pago',
    'Un gasto no puede conciliarse', 'ya esta conciliado con otro movimiento',
    'Aislamiento de proyecto',
  ];
  if (known.some((k) => raw.toLowerCase().includes(k.toLowerCase()))) {
    return raw.replace(/^.*?:\s*/, '');
  }
  return toUserMessage(raw);
}
