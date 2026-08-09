'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { deleteSaleItem, saveSaleItem } from '@/actions/sales';
import { formatMoney, humanize } from '@/lib/format';
import { SectionTitle } from '@/components/ui';
import { SALE_ITEM_TYPES } from '@/lib/validations/operations';
import type { CurrencyCode, SaleItem } from '@/types/database.types';

/**
 * Editor de lineas de venta.
 *
 * Cada linea lleva ademas su costo unitario estimado: es el presupuesto
 * inicial de la operacion y lo que alimenta el margen estimado mientras no
 * existan costos reales imputados. Guardar una linea recalcula el total de
 * la venta mediante trigger, no en el navegador.
 */
export function SaleLines({
  projectCode,
  saleId,
  lines,
  currency,
  editable,
  total,
}: {
  projectCode: string;
  saleId: string;
  lines: SaleItem[];
  currency: CurrencyCode;
  editable: boolean;
  total: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await saveSaleItem(null, formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function remove(lineId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteSaleItem(projectCode, lineId, saleId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const lineForm = (line: SaleItem | null) => (
    <form
      action={(formData) => submit(formData, () => (line ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="sale_id" value={saleId} />
      {line ? <input type="hidden" name="id" value={line.id} /> : null}

      <div className="col-span-6 sm:col-span-3">
        <label className="label">Tipo</label>
        <select name="product_type" defaultValue={line?.product_type ?? 'CANCHA_NUEVA'} className="input">
          {SALE_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{humanize(t)}</option>
          ))}
        </select>
      </div>
      <div className="col-span-6 sm:col-span-3">
        <label className="label">Descripcion</label>
        <input name="description" required defaultValue={line?.description} className="input"
          placeholder="Cancha panoramica 20x10" />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <label className="label">Cant.</label>
        <input name="quantity" type="number" step="0.001" min="0.001" required
          defaultValue={line?.quantity ?? 1} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Precio ud.</label>
        <input name="unit_price" type="number" step="0.01" min="0" required
          defaultValue={line?.unit_price ?? 0} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Costo est. ud.</label>
        <input name="estimated_unit_cost" type="number" step="0.01" min="0"
          defaultValue={line?.estimated_unit_cost ?? 0} className="input tabular" />
      </div>
      <div className="col-span-12 flex gap-1 sm:col-span-1">
        <button type="submit" disabled={isPending} className="btn-primary w-full px-2 py-2">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
        </button>
        <button type="button" className="btn-ghost px-2 py-2"
          onClick={() => (line ? setEditingId(null) : setAdding(false))} aria-label="Cancelar">
          <X size={14} />
        </button>
      </div>
    </form>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 pt-4">
        <SectionTitle className="mb-0">Detalle de la venta</SectionTitle>
        {editable && !adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary px-2 py-1 text-2xs">
            <Plus size={13} /> Anadir linea
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        {adding ? lineForm(null) : null}

        {lines.length === 0 && !adding ? (
          <p className="px-4 pb-4 text-sm text-content-muted">
            Sin lineas. Anade al menos una para poder confirmar la venta.
          </p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {lines.map((line) =>
                editingId === line.id ? (
                  <tr key={line.id}>
                    <td colSpan={5} className="p-0">{lineForm(line)}</td>
                  </tr>
                ) : (
                  <tr key={line.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p>{line.description}</p>
                      <p className="text-2xs text-content-muted">
                        {humanize(line.product_type)}
                        {line.model ? ` · ${line.model}` : ''}
                      </p>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right text-content-secondary">{line.quantity}</td>
                    <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                      {formatMoney(line.unit_price, currency)}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right font-medium">
                      {formatMoney(line.subtotal, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editable ? (
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditingId(line.id)}
                            className="btn-ghost px-2 py-1 text-2xs">Editar</button>
                          <button type="button" onClick={() => remove(line.id)} disabled={isPending}
                            className="btn-ghost px-2 py-1 text-critical" aria-label="Eliminar linea">
                            <Trash2 size={13} />
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <td colSpan={3} className="px-4 py-3 text-right text-xs text-content-muted">Total</td>
                <td className="tabular px-2 py-3 text-right text-base font-semibold">
                  {formatMoney(total, currency)}
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
