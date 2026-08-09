'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { changeCourtStatus } from '@/actions/operations';
import { humanize } from '@/lib/format';
import type { CourtKind, CourtStatus } from '@/types/database.types';

/**
 * Cambio de estado de cancha.
 *
 * Solo se ofrecen los estados validos para el tipo de cancha, los mismos
 * que admite el CHECK constraint en PostgreSQL. Ofrecer opciones que la
 * base va a rechazar seria enganar al usuario.
 */
const ALLOWED: Record<CourtKind, CourtStatus[]> = {
  NUEVA: [
    'PLANIFICADA', 'MATERIALES_PENDIENTES', 'EN_CONSTRUCCION', 'CONSTRUCCION_TERMINADA',
    'GALVANIZADO', 'GALVANIZADO_TERMINADO', 'EMBALAJE', 'EMBALADA', 'EN_TRANSITO',
    'EN_INSTALACION', 'INSTALACION_TERMINADA', 'ENTREGADA', 'BAJA',
  ],
  USADA: [
    'DISPONIBLE', 'RESERVADA', 'EN_DESMONTAJE', 'DESMONTADA', 'EN_REPARACION',
    'PREPARADA', 'EN_TRANSPORTE', 'EN_TRANSITO', 'EN_INSTALACION',
    'INSTALACION_TERMINADA', 'ENTREGADA', 'VENDIDA', 'BAJA',
  ],
};

export function CourtStatusControl({
  projectCode,
  courtId,
  currentStatus,
  courtType,
}: {
  projectCode: string;
  courtId: string;
  currentStatus: CourtStatus;
  courtType: CourtKind;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CourtStatus>(currentStatus);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options = ALLOWED[courtType].filter((s) => s !== currentStatus);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await changeCourtStatus({ projectCode, courtId, newStatus: status, comment });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setComment('');
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <ArrowRightLeft size={14} />
        Cambiar estado
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !isPending && setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-lg border border-line-strong bg-surface p-5 shadow-2xl animate-fade-in">
            <h2 className="text-base font-semibold">Cambiar estado</h2>
            <p className="mt-1 text-sm text-content-secondary">
              Estado actual: <span className="text-content">{humanize(currentStatus)}</span>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="new-status" className="label">
                  Nuevo estado
                </label>
                <select
                  id="new-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CourtStatus)}
                  className="input"
                >
                  <option value={currentStatus} disabled>
                    Selecciona un estado
                  </option>
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="comment" className="label">
                  Comentario (queda en el historial)
                </label>
                <textarea
                  id="comment"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input resize-none"
                  placeholder="Ej. Galvanizado recibido de Ebro, sin incidencias"
                />
              </div>
            </div>

            {error ? (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || status === currentStatus}
                className="btn-primary"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
