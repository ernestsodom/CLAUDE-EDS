'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { deleteInvoiceItem, saveInvoiceItem } from '@/actions/finance';
import { formatMoney } from '@/lib/format';
import { SectionTitle } from '@/components/ui';
import type { CurrencyCode } from '@/types/database.types';

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

/**
 * Editor de lineas de factura.
 *
 * Cada linea es su propio formulario: se guarda o se borra por separado y
 * el total de la cabecera lo recalcula un trigger en PostgreSQL. Asi no
 * existe un "borrador" en memoria que pueda perderse ni un total sumado en
 * el navegador que discrepe del que ve el resto del sistema.
 */
export function InvoiceLines({
  projectCode,
  invoiceId,
  lines,
  currency,
  editable,
  total,
}: {
  projectCode: string;
  invoiceId: string;
  lines: InvoiceLine[];
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
      const result = await saveInvoiceItem(null, formData);
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
      const result = await deleteInvoiceItem(projectCode, lineId, invoiceId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const lineForm = (line: InvoiceLine | null) => (
    <form
      action={(formData) => submit(formData, () => (line ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      {line ? <input type="hidden" name="id" value={line.id} /> : null}

      <div className="col-span-12 sm:col-span-5">
        <label className="label">Concepto</label>
        <input name="description" required defaultValue={line?.description} className="input"
          placeholder="4 canchas panoramicas + transporte" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Cantidad</label>
        <input name="quantity" type="number" step="0.001" min="0.001" required
          defaultValue={line?.quantity ?? 1} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Precio</label>
        <input name="unit_price" type="number" step="0.01" min="0" required
          defaultValue={line?.unit_price ?? 0} className="input tabular" />
      </div>
      <div className="col-span-4 sm:col-span-2">
        <label className="label">Descuento</label>
        <input name="discount" type="number" step="0.01" min="0"
          defaultValue={line?.discount ?? 0} className="input tabular" />
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
        <SectionTitle className="mb-0">Lineas de la factura</SectionTitle>
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

      <div className="mt-3">
        {adding ? lineForm(null) : null}

        {lines.length === 0 && !adding ? (
          <p className="px-4 pb-4 text-sm text-content-muted">
            Sin lineas. El total de la factura es la suma de sus lineas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {lines.map((line) =>
                editingId === line.id ? (
                  <tr key={line.id}>
                    <td colSpan={5} className="p-0">{lineForm(line)}</td>
                  </tr>
                ) : (
                  <tr key={line.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">{line.description}</td>
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
                <td colSpan={3} className="px-4 py-3 text-right text-xs text-content-muted">
                  Total factura
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
