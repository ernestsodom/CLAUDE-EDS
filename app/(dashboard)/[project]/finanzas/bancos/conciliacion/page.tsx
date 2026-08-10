import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { getBankAccountOptions } from '@/lib/services/options';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { Card, DataPoint, EmptyState, ErrorState, PageHeader, SectionTitle } from '@/components/ui';
import { StatementImporter } from '@/components/finance/statement-importer';
import { ReconciliationRow, type TransactionRow } from '@/components/finance/reconciliation-row';

interface AccountSummary {
  bank_account_id: string; account_name: string; currency: string;
  total_transactions: number; reconciled_transactions: number; pending_transactions: number;
  pending_amount: number; reconciled_pct: number | null; last_movement_date: string | null;
}
interface ImportBatch {
  id: string; file_name: string; file_format: string; row_count: number;
  inserted_count: number; duplicate_count: number; error_count: number;
  period_from: string | null; period_to: string | null; created_at: string;
}

export const metadata: Metadata = { title: 'Conciliacion bancaria' };

/**
 * Conciliacion bancaria (FASE 9b).
 *
 * La pantalla responde a una sola pregunta: que ha pasado por el banco
 * que todavia no esta explicado en el sistema. Por eso lo primero que se
 * ve son los movimientos pendientes, y no un listado completo donde lo
 * pendiente se pierde entre lo ya cuadrado.
 */
export default async function ReconciliationPage({
  params, searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ cuenta?: string; estado?: string }>;
}) {
  const { project: projectCode } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(projectCode);

  const supabase = await createClient();
  const showReconciled = sp.estado === 'conciliados';

  let query = supabase
    .from('bank_transactions')
    .select('*')
    .eq('project_id', project.id)
    .eq('reconciled', showReconciled)
    .order('transaction_date', { ascending: false })
    .limit(100);

  if (sp.cuenta) query = query.eq('bank_account_id', sp.cuenta);

  const [transactionsRes, summaryRes, batchesRes, accounts] = await Promise.all([
    query,
    supabase.from('v_bank_reconciliation')
      .select('*')
      .eq('project_id', project.id)
      .order('account_name'),
    supabase.from('bank_import_batches')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(5),
    getBankAccountOptions(project.id),
  ]);

  if (transactionsRes.error || summaryRes.error) {
    return (<><PageHeader title="Conciliacion bancaria" /><ErrorState /></>);
  }

  const transactions = (transactionsRes.data ?? []) as unknown as TransactionRow[];
  const summary = (summaryRes.data ?? []) as unknown as AccountSummary[];
  const batches = (batchesRes.data ?? []) as unknown as ImportBatch[];

  const totalPending = summary.reduce((sum, s) => sum + Number(s.pending_transactions ?? 0), 0);
  const totalMovements = summary.reduce((sum, s) => sum + Number(s.total_transactions ?? 0), 0);
  const reconciledPct = totalMovements > 0
    ? ((totalMovements - totalPending) / totalMovements) * 100
    : null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/${projectCode}/finanzas/bancos`} className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} /> Bancos
          </Link>
        }
        title="Conciliacion bancaria"
        subtitle="Cada movimiento del banco, explicado por un pago o un gasto del sistema"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <DataPoint label="Movimientos importados" value={totalMovements} />
        </Card>
        <Card className="p-5">
          <DataPoint label="Pendientes de conciliar" value={totalPending}
            tone={totalPending > 0 ? 'warning' : 'success'} />
        </Card>
        <Card className="p-5">
          <DataPoint label="Conciliado" value={formatPercent(reconciledPct)}
            tone={reconciledPct !== null && reconciledPct >= 95 ? 'success' : 'default'} />
        </Card>
      </div>

      {can(project, 'banks.create') && accounts.length > 0 ? (
        <div className="mb-6">
          <StatementImporter projectCode={project.code} accounts={accounts} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle
                title={showReconciled ? 'Movimientos conciliados' : 'Movimientos pendientes'}
                subtitle={`${transactions.length} mostrados`}
              />
              <div className="flex gap-2">
                <Link
                  href={`/${projectCode}/finanzas/bancos/conciliacion${sp.cuenta ? `?cuenta=${sp.cuenta}` : ''}`}
                  className={showReconciled ? 'btn-ghost text-2xs' : 'btn-secondary text-2xs'}
                >
                  Pendientes
                </Link>
                <Link
                  href={`/${projectCode}/finanzas/bancos/conciliacion?estado=conciliados${sp.cuenta ? `&cuenta=${sp.cuenta}` : ''}`}
                  className={showReconciled ? 'btn-secondary text-2xs' : 'btn-ghost text-2xs'}
                >
                  Conciliados
                </Link>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title={showReconciled ? 'Todavia no hay movimientos conciliados' : 'Nada pendiente'}
                  description={
                    showReconciled
                      ? 'Concilia un movimiento pendiente y aparecera aqui.'
                      : 'Todos los movimientos importados estan explicados por un pago o un gasto.'
                  }
                />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {transactions.map((t) => (
                  <ReconciliationRow key={t.id} projectCode={projectCode} transaction={t} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="Por cuenta" />
            <ul className="mt-3 divide-y divide-line">
              {summary.map((s) => (
                <li key={s.bank_account_id} className="py-2.5">
                  <Link
                    href={`/${projectCode}/finanzas/bancos/conciliacion?cuenta=${s.bank_account_id}`}
                    className="flex items-center justify-between gap-3 hover:text-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{s.account_name}</span>
                      <span className="block text-2xs text-content-muted">
                        {s.pending_transactions} pendientes de {s.total_transactions}
                        {s.last_movement_date ? ` · ultimo ${formatDate(s.last_movement_date)}` : ''}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm">
                      {formatPercent(s.reconciled_pct)}
                    </span>
                  </Link>
                </li>
              ))}
              {summary.length === 0 ? (
                <li className="py-2 text-sm text-content-muted">Sin cuentas bancarias.</li>
              ) : null}
            </ul>
          </Card>

          {batches.length > 0 ? (
            <Card className="p-5">
              <SectionTitle title="Importaciones recientes" />
              <ul className="mt-3 divide-y divide-line">
                {batches.map((b) => (
                  <li key={b.id} className="py-2.5">
                    <p className="truncate text-sm">{b.file_name}</p>
                    <p className="text-2xs text-content-muted">
                      {formatDate(b.created_at)} · {b.inserted_count} nuevos
                      {b.duplicate_count > 0 ? `, ${b.duplicate_count} duplicados` : ''}
                      {b.error_count > 0 ? `, ${b.error_count} con error` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-5">
            <SectionTitle title="Como funciona" />
            <ul className="mt-3 space-y-2 text-sm text-content-secondary">
              <li>· Reimportar el mismo extracto no duplica movimientos: cada apunte lleva una huella unica por cuenta.</li>
              <li>· Un pago o un gasto solo puede conciliarse con un movimiento.</li>
              <li>· El importe y la direccion del dinero tienen que coincidir; lo comprueba PostgreSQL, no la pantalla.</li>
              <li>· El extracto original queda archivado en Storage por si hay que auditar.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
