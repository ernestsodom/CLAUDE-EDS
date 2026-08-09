import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/**
 * Embudo operacional: donde estan fisicamente las canchas.
 *
 * Deliberadamente no es un grafico de libreria. Son barras proporcionales
 * clickeables: se leen de un vistazo y cada una lleva al listado filtrado
 * que la explica (§113, §114).
 */
export function CourtFunnel({
  data,
}: {
  data: { label: string; value: number; href: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((stage) => {
        const pct = (stage.value / max) * 100;
        return (
          <li key={stage.label}>
            <Link href={stage.href} className="group block">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-xs text-content-secondary group-hover:text-content">
                  {stage.label}
                </span>
                <span className="tabular text-sm font-semibold">
                  {formatNumber(stage.value)}
                </span>
              </div>
              <div className="progress">
                <div
                  className={cn(
                    'progress-bar',
                    stage.value === 0 ? 'bg-line-strong' : 'bg-accent',
                  )}
                  style={{ width: `${Math.max(pct, stage.value > 0 ? 4 : 2)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
