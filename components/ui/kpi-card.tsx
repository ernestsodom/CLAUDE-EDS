import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * KPI clickeable (§49, §50, §114).
 *
 * Todo indicador navega al listado filtrado que lo explica. Un numero que
 * no lleva a ninguna parte obliga al usuario a buscar la causa a mano, y
 * eso es exactamente lo que este sistema debe evitar.
 */
export function KpiCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'critical';
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}) {
  const toneRing = {
    default: 'hover:border-line-strong',
    accent: 'border-accent/25 hover:border-accent/50',
    success: 'border-success/25 hover:border-success/50',
    warning: 'border-warning/25 hover:border-warning/50',
    critical: 'border-critical/25 hover:border-critical/50',
  }[tone];

  const toneText = {
    default: 'text-content',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-critical',
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wider text-content-muted">
          {label}
        </span>
        {icon ? <span className="text-content-muted">{icon}</span> : null}
      </div>

      <div className={cn('tabular mt-2 text-2xl font-semibold leading-none', toneText)}>
        {value}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {hint ? <span className="truncate text-2xs text-content-muted">{hint}</span> : <span />}
        {trend ? (
          <span
            className={cn(
              'tabular text-2xs font-medium',
              trend.positive ? 'text-success' : 'text-critical',
            )}
          >
            {trend.value}
          </span>
        ) : null}
        {href ? (
          <ArrowUpRight
            size={14}
            className="shrink-0 text-content-muted opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </div>
    </>
  );

  const base = cn('card group p-4 transition-colors', toneRing, className);

  if (!href) return <div className={base}>{body}</div>;

  return (
    <Link href={href} className={cn(base, 'block hover:bg-elevated')}>
      {body}
    </Link>
  );
}

/** Fila compacta de KPIs secundarios. */
export function KpiInline({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'critical';
}) {
  const toneText = {
    default: 'text-content',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-critical',
  }[tone];

  const inner = (
    <>
      <span className="text-2xs uppercase tracking-wide text-content-muted">{label}</span>
      <span className={cn('tabular text-sm font-semibold', toneText)}>{value}</span>
    </>
  );

  if (!href) {
    return <div className="flex flex-col gap-0.5">{inner}</div>;
  }
  return (
    <Link
      href={href}
      className="flex flex-col gap-0.5 rounded px-2 py-1 -mx-2 transition-colors hover:bg-elevated"
    >
      {inner}
    </Link>
  );
}
