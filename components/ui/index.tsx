import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------
// Superficies
// ---------------------------------------------------------------------
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn('card', padded && 'p-4', className)}>{children}</div>;
}

export function SectionTitle({
  children,
  title,
  subtitle,
  action,
  className,
}: {
  children?: ReactNode;
  /** Alternativa a `children` cuando la seccion tambien lleva subtitulo. */
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-content-muted">
          {children ?? title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-2xs normal-case tracking-normal text-content-muted">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {breadcrumb ? <div className="mb-2 text-xs text-content-muted">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-content-secondary">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
// Estados: loading · empty · error  (§96)
// Toda pantalla debe contemplarlos. No se muestran errores tecnicos crudos.
// ---------------------------------------------------------------------
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-3 text-content-muted">{icon ?? <Inbox size={28} strokeWidth={1.5} />}</div>
      <p className="text-sm font-medium text-content">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-content-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'No se pudo cargar la informacion',
  description,
  retryHref,
}: {
  title?: string;
  description?: string;
  retryHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-critical/30 bg-critical/5 px-6 py-12 text-center">
      <AlertTriangle size={28} strokeWidth={1.5} className="mb-3 text-critical" />
      <p className="text-sm font-medium text-content">{title}</p>
      <p className="mt-1 max-w-md text-sm text-content-secondary">
        {description ??
          'Ha ocurrido un problema al consultar los datos. Vuelve a intentarlo; si persiste, avisa al administrador.'}
      </p>
      {retryHref ? (
        <Link href={retryHref} className="btn-secondary mt-4">
          <RefreshCw size={14} />
          Reintentar
        </Link>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-elevated/40 px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-line px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3', c === 0 ? 'w-40' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------
export function ProgressBar({
  value,
  tone = 'accent',
  showLabel = false,
  className,
}: {
  value: number | null | undefined;
  tone?: 'accent' | 'success' | 'warning' | 'critical';
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const toneClass = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    critical: 'bg-critical',
  }[tone];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="progress flex-1">
        <div className={cn('progress-bar', toneClass)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel ? (
        <span className="tabular w-10 text-right text-2xs text-content-muted">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
}

export function DataPoint({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'critical' | 'accent';
  className?: string;
}) {
  const toneClass = {
    default: 'text-content',
    success: 'text-success',
    warning: 'text-warning',
    critical: 'text-critical',
    accent: 'text-accent',
  }[tone ?? 'default'];

  return (
    <div className={className}>
      <dt className="text-2xs font-medium uppercase tracking-wide text-content-muted">{label}</dt>
      <dd className={cn('tabular mt-1 text-lg font-semibold', toneClass)}>{value}</dd>
      {hint ? <p className="mt-0.5 text-2xs text-content-muted">{hint}</p> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-wide text-content-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-content">{children ?? '—'}</dd>
    </div>
  );
}
