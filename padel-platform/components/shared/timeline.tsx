import { formatRelative, formatDate } from '@/lib/format';
import type { ProjectEvent } from '@/types/database.types';

/**
 * Timeline unificado (§28, §123).
 *
 * Los eventos no se escriben desde el frontend: los generan triggers en
 * PostgreSQL. Esto responde "que paso, cuando y quien lo hizo" aunque el
 * cambio se haya producido por un job o por otra pantalla.
 */
export function Timeline({ events }: { events: ProjectEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-content-muted">Sin actividad registrada.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent ring-4 ring-surface"
            aria-hidden
          />
          <p className="text-sm leading-snug">{event.title}</p>
          {event.description ? (
            <p className="mt-0.5 text-2xs text-content-secondary">{event.description}</p>
          ) : null}
          <time
            dateTime={event.event_date}
            title={formatDate(event.event_date, 'datetime')}
            className="mt-0.5 block text-2xs text-content-muted"
          >
            {formatRelative(event.event_date)}
          </time>
        </li>
      ))}
    </ol>
  );
}
