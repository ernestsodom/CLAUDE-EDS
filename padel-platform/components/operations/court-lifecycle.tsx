import { Check, Circle, Dot } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, humanize } from '@/lib/format';
import type { CourtKind, CourtStatus, CourtStatusHistory } from '@/types/database.types';

/**
 * Ciclo de vida de la cancha (§74).
 *
 * Las dos secuencias (nueva y usada) reflejan exactamente los estados que
 * el constraint `courts_status_domain_ck` permite en la base. La UI no
 * inventa fases que PostgreSQL no acepta.
 */
const LIFECYCLE: Record<CourtKind, CourtStatus[]> = {
  NUEVA: [
    'PLANIFICADA',
    'MATERIALES_PENDIENTES',
    'EN_CONSTRUCCION',
    'CONSTRUCCION_TERMINADA',
    'GALVANIZADO',
    'GALVANIZADO_TERMINADO',
    'EMBALAJE',
    'EMBALADA',
    'EN_TRANSITO',
    'EN_INSTALACION',
    'INSTALACION_TERMINADA',
    'ENTREGADA',
  ],
  USADA: [
    'DISPONIBLE',
    'RESERVADA',
    'EN_DESMONTAJE',
    'DESMONTADA',
    'EN_REPARACION',
    'PREPARADA',
    'EN_TRANSPORTE',
    'EN_INSTALACION',
    'INSTALACION_TERMINADA',
    'ENTREGADA',
  ],
};

export function CourtLifecycle({
  courtType,
  currentStatus,
  history,
}: {
  courtType: CourtKind;
  currentStatus: CourtStatus;
  history: CourtStatusHistory[];
}) {
  const stages = LIFECYCLE[courtType];
  const currentIndex = stages.indexOf(currentStatus);

  // Fecha en que se alcanzo cada estado, tomada del historial real
  const reachedAt = new Map<string, string>();
  for (const h of history) {
    if (!reachedAt.has(h.new_status)) reachedAt.set(h.new_status, h.changed_at);
  }

  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => {
        const done = currentIndex >= 0 && index < currentIndex;
        const current = stage === currentStatus;
        const when = reachedAt.get(stage);
        const isLast = index === stages.length - 1;

        return (
          <li key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  done && 'border-success bg-success/20 text-success',
                  current && 'border-accent bg-accent text-black',
                  !done && !current && 'border-line-strong bg-base text-content-muted',
                )}
              >
                {done ? (
                  <Check size={11} strokeWidth={3} />
                ) : current ? (
                  <Dot size={16} strokeWidth={4} />
                ) : (
                  <Circle size={7} strokeWidth={3} />
                )}
              </span>
              {!isLast ? (
                <span
                  className={cn('w-px flex-1 min-h-[18px]', done ? 'bg-success/40' : 'bg-line')}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className={cn('pb-3', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm leading-5',
                  current ? 'font-medium text-accent' : done ? 'text-content' : 'text-content-muted',
                )}
              >
                {humanize(stage)}
              </p>
              {when ? (
                <p className="text-2xs text-content-muted">{formatDate(when)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
