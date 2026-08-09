'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { deleteSaleCost, saveSaleCost } from '@/actions/sales';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/format';
import { SectionTitle } from '@/components/ui';
import { COST_STATUSES } from '@/lib/validations/operations';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface SaleCostRow {
  id: string;
  cost_category_id: string;
  description: string | null;
  estimated_amount: number;
  actual_amount: number;
  status: string;
  supplier_id: string | null;
  cost_date: string | null;
  cost_categories: { name: string; cost_group: string } | null;
}

/**
 * Presupuesto vs real por linea de costo (§21, §54).
 *
 * Es la pantalla donde el margen deja de ser una estimacion: cada importe
 * real que se registra aqui mueve el margen de la venta y, si supera el
 * umbral del proyecto, dispara la alerta de sobrecosto.
 */
export function SaleCostsEditor({
  projectCode,
  saleId,
  rows,
  currency,
  categories,
  suppliers,
  editable,
}: {
  projectCode: string;
  saleId: string;
  rows: SaleCostRow[];
  currency: CurrencyCode;
  categories: Option[];
  suppliers: Option[];
  editable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalEstimated = rows.reduce((s, r) => s + Number(r.estimated_amount), 0);
  const totalActual = rows.reduce((s, r) => s + Number(r.actual_amount), 0);
  const deviation = totalActual - totalEstimated;

  function submit(formData: FormData, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await saveSaleCost(null, formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function remove(rowId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteSaleCost(projectCode, rowId, saleId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const rowForm = (row: SaleCostRow | null) => (
    <form
      action={(formData) => submit(formData, () => (row ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="sale_id" value={saleId} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}

      <div className="col-span-12 sm:col-span-3">
        <label className="label">Categoria</label>
        <select name="cost_category_id" required defaultValue={row?.cost_category_id ?? ''} className="input">
          <option value="">Selecciona...</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="col-span-12 sm:col-span-3">
        <label className="label">Descripcion</label>
        <input name="description" defaultValue={row?.description ?? ''} className="input"
          placeholder="Galvanizado 4 canchas" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Estimado</label>
        <input name="estimated_amount" type="number" step="0.01" min="0"
          defaultValue={row?.estimated_amount ?? 0} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Real</label>
        <input name="actual_amount" type="number" step="0.01" min="0"
          defaultValue={row?.actual_amount ?? 0} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <label className="label">Estado</label>
        <select name="status" defaultValue={row?.status ?? 'ESTIMADO'} className="input">
          {COST_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="col-span-12 flex gap-1 sm:col-span-1">
        <button type="submit" disabled={isPending} className="btn-primary w-full px-2 py-2">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
        </button>
        <button type="button" className="btn-ghost px-2 py-2"
          onClick={() => (row ? setEditingId(null) : setAdding(false))} aria-label="Cancelar">
          <X size={14} />
        </button>
      </div>

      <input type="hidden" name="currency" value={currency} />
      {suppliers.length > 0 ? (
        <div className="col-span-12 sm:col-span-4">
          <label className="label">Proveedor (opcional)</label>
          <select name="supplier_id" defaultValue={row?.supplier_id ?? ''} className="input">
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}
    </form>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 pt-4">
        <SectionTitle className="mb-0">Costos: presupuesto vs real</SectionTitle>
        {editable && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary px-2 py-1 text-2xs">
            <Plus size={13} /> Anadir costo
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        {adding ? rowForm(null) : null}

        {rows.length === 0 && !adding ? (
          <p className="px-4 pb-4 text-sm text-content-muted">
            Sin costos registrados. Al confirmar la venta se generan los estimados a partir de las lineas.
          </p>
        ) : (
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-y border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
                <th className="px-4 py-2 text-left font-semibold">Categoria</th>
                <th className="px-2 py-2 text-right font-semibold">Estimado</th>
                <th className="px-2 py-2 text-right font-semibold">Real</th>
                <th className="px-2 py-2 text-right font-semibold">Desviacion</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dev = Number(row.actual_amount) - Number(row.estimated_amount);
                const devPct =
                  Number(row.estimated_amount) > 0
                    ? (dev / Number(row.estimated_amount)) * 100
                    : null;
                return editingId === row.id ? (
                  <tr key={row.id}>
                    <td colSpan={5} className="p-0">{rowForm(row)}</td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p>{row.cost_categories?.name ?? '—'}</p>
                      <p className="text-2xs text-content-muted">
                        {row.cost_categories?.cost_group}
                        {row.description ? ` · ${row.description}` : ''}
                      </p>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                      {formatMoney(row.estimated_amount, currency)}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">
                      {Number(row.actual_amount) > 0 ? formatMoney(row.actual_amount, currency) : '—'}
                    </td>
                    <td
                      className={cn(
                        'tabular px-2 py-2.5 text-right font-medium',
                        Number(row.actual_amount) === 0
                          ? 'text-content-muted'
                          : dev > 0
                            ? 'text-critical'
                            : 'text-success',
                      )}
                    >
                      {Number(row.actual_amount) > 0 ? (
                        <>
                          {dev > 0 ? '+' : ''}
                          {formatMoney(dev, currency)}
                          {devPct !== null ? (
                            <span className="ml-1 text-2xs">({formatPercent(devPct)})</span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editable ? (
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditingId(row.id)}
                            className="btn-ghost px-2 py-1 text-2xs">Editar</button>
                          <button type="button" onClick={() => remove(row.id)} disabled={isPending}
                            className="btn-ghost px-2 py-1 text-critical" aria-label="Eliminar costo">
                            <Trash2 size={13} />
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <td className="px-4 py-3 text-xs font-medium text-content-muted">Total</td>
                <td className="tabular px-2 py-3 text-right font-semibold">
                  {formatMoney(totalEstimated, currency)}
                </td>
                <td className="tabular px-2 py-3 text-right font-semibold">
                  {formatMoney(totalActual, currency)}
                </td>
                <td className={cn('tabular px-2 py-3 text-right font-semibold',
                  deviation > 0 ? 'text-critical' : 'text-success')}>
                  {deviation > 0 ? '+' : ''}
                  {formatMoney(deviation, currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
