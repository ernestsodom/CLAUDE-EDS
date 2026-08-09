import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney } from '@/lib/format';
import { Card, EmptyState, ErrorState, PageHeader, SectionTitle } from '@/components/ui';
import type { CurrencyCode } from '@/types/database.types';

export const metadata: Metadata = { title: 'Bancos' };

export default async function BanksPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectCode } = await params;
  const { project } = await requireProject(projectCode);
  const supabase = await createClient();

  const [accountsRes, txRes] = await Promise.all([
    supabase.from('bank_accounts').select('*').eq('project_id', project.id).is('deleted_at', null).order('name'),
    supabase.from('bank_transactions').select('*').eq('project_id', project.id).order('transaction_date', { ascending: false }).limit(40),
  ]);

  if (accountsRes.error) return (<><PageHeader title="Bancos" /><ErrorState /></>);

  const accounts = (accountsRes.data ?? []) as {
    id: string; name: string; bank_name: string | null; iban: string | null;
    currency: CurrencyCode; opening_balance: number; active: boolean;
  }[];
  const transactions = (txRes.data ?? []) as {
    id: string; transaction_date: string; description: string | null; counterparty: string | null;
    amount: number; currency: CurrencyCode; transaction_type: string; reconciled: boolean;
  }[];

  return (
    <>
      <PageHeader
        title="Bancos"
        subtitle={`${accounts.length} cuentas`}
        actions={
          can(project, 'banks.create') ? (
            <Link href={`/${project.code}/finanzas/bancos/form`} className="btn-primary">
              <Plus size={15} />
              Nueva cuenta
            </Link>
          ) : null
        }
      />

      {accounts.length === 0 ? (
        <EmptyState title="Sin cuentas bancarias" description="Configura las cuentas del proyecto para conciliar movimientos." />
      ) : (
        <>
          <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <Link href={`/${project.code}/finanzas/bancos/form/${acc.id}`}
                  className="text-sm font-medium hover:text-accent">
                  {acc.name}
                </Link>
                <p className="text-2xs text-content-muted">{acc.bank_name ?? '—'}</p>
                <p className="tabular mt-2 text-xl font-semibold">
                  {formatMoney(acc.opening_balance, acc.currency)}
                </p>
                <p className="mt-1 truncate text-2xs text-content-muted">{acc.iban ?? ''}</p>
              </Card>
            ))}
          </section>

          <SectionTitle>Movimientos recientes</SectionTitle>
          {transactions.length === 0 ? (
            <EmptyState
              title="Sin movimientos"
              description="Los extractos se pueden importar desde CSV o XLSX; la deduplicacion por hash evita cargar dos veces el mismo movimiento."
            />
          ) : (
            <Card padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                      <th className="px-4 py-2.5 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Descripcion</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Contraparte</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Importe</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Conciliado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-line last:border-0">
                        <td className="tabular px-4 py-2.5">{formatDate(tx.transaction_date)}</td>
                        <td className="px-4 py-2.5">{tx.description ?? '—'}</td>
                        <td className="px-4 py-2.5 text-content-secondary">{tx.counterparty ?? '—'}</td>
                        <td className={`tabular px-4 py-2.5 text-right font-medium ${Number(tx.amount) >= 0 ? 'text-success' : 'text-content'}`}>
                          {formatMoney(tx.amount, tx.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {tx.reconciled ? (
                            <span className="badge border border-success/30 bg-success/15 text-success">Si</span>
                          ) : (
                            <span className="badge border border-line bg-elevated text-content-muted">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
