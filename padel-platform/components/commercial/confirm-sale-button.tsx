'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { confirmSale } from '@/actions/sales';

/**
 * Confirmar venta (§55).
 *
 * Es una accion con consecuencias amplias (crea canchas, fabricacion,
 * costos y checklists), asi que se confirma explicitamente y se explica
 * antes lo que va a ocurrir. Nada de un boton suelto que dispara siete
 * efectos sin avisar.
 */
export function ConfirmSaleButton({
  projectCode,
  saleId,
}: {
  projectCode: string;
  saleId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [createManufacturing, setCreateManufacturing] = useState(true);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await confirmSale({
        projectCode,
        saleId,
        createManufacturing,
        deliveryDate,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? 'Venta confirmada.');
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 1600);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <CheckCircle2 size={15} />
        Confirmar venta
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-sale-title"
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => !isPending && setOpen(false)} />

          <div className="relative w-full max-w-md rounded-lg border border-line-strong bg-surface p-5 shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => !isPending && setOpen(false)}
              className="btn-ghost absolute right-2 top-2 px-2 py-1"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            <h2 id="confirm-sale-title" className="text-base font-semibold">
              Confirmar venta
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              Al confirmar, el sistema generara automaticamente:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-content-secondary">
              <li className="flex gap-2">
                <span className="text-accent">·</span> Las canchas comprometidas en la venta
              </li>
              <li className="flex gap-2">
                <span className="text-accent">·</span> El proyecto de fabricacion
              </li>
              <li className="flex gap-2">
                <span className="text-accent">·</span> Los costos estimados por categoria
              </li>
              <li className="flex gap-2">
                <span className="text-accent">·</span> Los checklists de venta y produccion
              </li>
            </ul>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="delivery" className="label">
                  Fecha de entrega comprometida
                </label>
                <input
                  id="delivery"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="input"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-content-secondary">
                <input
                  type="checkbox"
                  checked={createManufacturing}
                  onChange={(e) => setCreateManufacturing(e.target.checked)}
                  className="h-4 w-4 accent-[rgb(255,90,0)]"
                />
                Crear proyecto de fabricacion
              </label>
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {done ? (
              <div className="mt-4 flex items-start gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                <span>{done}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || Boolean(done)}
                className="btn-primary"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                {isPending ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
