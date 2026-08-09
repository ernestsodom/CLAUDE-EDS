'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { deletePurchaseOrderItem, savePurchaseOrderItem } from '@/actions/operations';
import { formatMoney } from '@/lib/format';
import { SectionTitle } from '@/components/ui';
import type { Option } from '@/lib/services/options';
import type { CurrencyCode } from '@/types/database.types';

export interface PurchaseOrderLine {
  id: string; description: string; material_id: string | null;
  quantity: number; unit: string; unit_price: number;
  subtotal: number; quantity_received: number;
}

/** Lineas de orden de compra. El total lo recalcula un trigger. */
export function PurchaseOrderLines({
  projectCode, purchaseOrderId, lines, currency, editable, total, materials,
}: {
  projectCode: string; purchaseOrderId: string; lines: PurchaseOrderLine[];
  currency: CurrencyCode; editable: boolean; total: number; materials: Option[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await savePurchaseOrderItem(null, formData);
      if (result && !result.ok) { setError(result.error); return; }
      onDone();
      router.refresh();
    });
  }

  function remove(lineId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePurchaseOrderItem(projectCode, lineId, purchaseOrderId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const lineForm = (line: PurchaseOrderLine | null) => (
    <form
      action={(formData) => submit(formData, () => (line ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
      {line ? <input type="hidden" name="id" value={line.id} /> : null}

      <div className="col-span-12 sm:col-span-3">
        <label className="label">Material</label>
        <select name="material_id" defaultValue={line?.material_id ?? ''} className="input">
          <option value="">Sin catalogo</option>
          {materials.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="col-span-12 sm:col-span-3">
        <label className="label">Descripcion</label>
        <input name="description" required defaultValue={line?.description} className="input" />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label className="label">Cant.</label>
        <input name="quantity" type="number" step="0.001" min="0.001" required
          defaultValue={line?.quantity ?? 1} className="input tabular" />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label className="label">Unidad</label>
        <input name="unit" defaultValue={line?.unit ?? 'UN'} className="input" />
      </div>
      <div className="col-span-3 sm:col-span-2">
        <label className="label">Precio ud.</label>
        <input name="unit_price" type="number" step="0.0001" min="0" required
          defaultValue={line?.unit_price ?? 0} className="input tabular" />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label className="label">Recibido</label>
        <input name="quantity_received" type="number" step="0.001" min="0"
          defaultValue={line?.quantity_received ?? 0} className="input tabular" />
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
        <SectionTitle className="mb-0">Lineas de la orden</SectionTitle>
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
          <p className="px-4 pb-4 text-sm text-content-muted">Sin lineas.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {lines.map((line) =>
                editingId === line.id ? (
                  <tr key={line.id}><td colSpan={5} className="p-0">{lineForm(line)}</td></tr>
                ) : (
                  <tr key={line.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p>{line.description}</p>
                      <p className="text-2xs text-content-muted">
                        recibido {line.quantity_received} de {line.quantity} {line.unit}
                      </p>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                      {line.quantity} {line.unit}
                    </td>
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
                <td colSpan={3} className="px-4 py-3 text-right text-xs text-content-muted">
                  Total con IVA
                </td>
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
