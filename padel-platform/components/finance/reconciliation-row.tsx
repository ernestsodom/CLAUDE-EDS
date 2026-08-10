'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, Search, Unlink } from 'lucide-react';
import {
  getMatchCandidates, reconcileTransaction, unreconcileTransaction,
  type MatchCandidate,
} from '@/actions/bank';
import { formatDate, formatMoney } from '@/lib/format';

export interface TransactionRow {
  id: string;
  transaction_date: string;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  amount: number;
  currency: string;
  reconciled: boolean;
  payment_id: string | null;
  expense_id: string | null;
}

/**
 * Una fila de conciliacion.
 *
 * Los candidatos no se cargan de golpe para toda la pagina: se piden al
 * pulsar "buscar" sobre el movimiento concreto. Una pantalla con 500
 * movimientos pendientes no puede lanzar 500 consultas de coincidencias
 * al abrirse.
 *
 * La puntuacion que se muestra viene de PostgreSQL —cercania de importe,
 * de fecha y coincidencia de referencia— y sirve para ordenar, no para
 * decidir. Conciliar sigue siendo un clic de una persona.
 */
export function ReconciliationRow({
  projectCode, transaction,
}: { projectCode: string; transaction: TransactionRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);

  async function loadCandidates() {
    setOpen(true);
    if (candidates) return;
    setBusy(true); setError(null);
    try {
      const result = await getMatchCandidates(projectCode, transaction.id);
      if (!result.ok) { setError(result.error); return; }
      setCandidates(result.data);
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(candidate: MatchCandidate) {
    setBusy(true); setError(null);
    try {
      const result = await reconcileTransaction({
        projectCode,
        transactionId: transaction.id,
        kind: candidate.kind,
        targetId: candidate.id,
      });
      if (!result.ok) { setError(result.error); return; }
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true); setError(null);
    try {
      const result = await unreconcileTransaction(projectCode, transaction.id);
      if (!result.ok) { setError(result.error); return; }
      setCandidates(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const incoming = transaction.amount >= 0;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {transaction.description || transaction.counterparty || 'Movimiento sin concepto'}
          </p>
          <p className="text-2xs text-content-muted">
            {formatDate(transaction.transaction_date)}
            {transaction.reference ? ` · ${transaction.reference}` : ''}
            {transaction.counterparty ? ` · ${transaction.counterparty}` : ''}
          </p>
        </div>

        <span className={`tabular text-sm font-semibold ${incoming ? 'text-success' : 'text-critical'}`}>
          {formatMoney(transaction.amount, transaction.currency as 'EUR')}
        </span>

        {transaction.reconciled ? (
          <button type="button" onClick={undo} disabled={busy} className="btn-ghost text-2xs">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
            Desconciliar
          </button>
        ) : (
          <button type="button" onClick={loadCandidates} disabled={busy} className="btn-secondary">
            {busy && !candidates ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Buscar coincidencia
          </button>
        )}
      </div>

      {error ? <p className="mt-2 text-2xs text-critical">{error}</p> : null}

      {open && !transaction.reconciled ? (
        <div className="mt-3 rounded border border-line bg-surface-2 p-3">
          {busy && !candidates ? (
            <p className="text-sm text-content-muted">Buscando pagos y gastos compatibles...</p>
          ) : candidates && candidates.length > 0 ? (
            <ul className="divide-y divide-line">
              {candidates.map((candidate) => (
                <li key={`${candidate.kind}-${candidate.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="badge border border-line bg-elevated text-content-secondary">
                        {candidate.kind === 'PAYMENT' ? 'Pago' : 'Gasto'}
                      </span>{' '}
                      {candidate.description || candidate.reference || 'Sin descripcion'}
                    </p>
                    <p className="text-2xs text-content-muted">
                      {formatDate(candidate.entity_date)} · afinidad {candidate.score}
                    </p>
                  </div>
                  <span className="tabular text-sm">
                    {formatMoney(candidate.amount, candidate.currency as 'EUR')}
                  </span>
                  <button type="button" className="btn-primary" disabled={busy}
                    onClick={() => reconcile(candidate)}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                    Conciliar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-content-muted">
              No hay ningun pago ni gasto con este importe en fechas proximas. Registra primero
              el pago o el gasto y vuelve a intentarlo.
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn-ghost text-2xs" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
