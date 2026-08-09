import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui';

export interface Column<T> {
  key: string;
  header: string;
  /** Renderiza la celda. Se ejecuta en el servidor. */
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Oculta la columna por debajo de md. Para tablas anchas en movil. */
  hideOnMobile?: boolean;
  width?: string;
}

/**
 * Tabla con paginacion server-side (§77, §78).
 *
 * Nunca recibe "todos los registros": la pagina la resuelve PostgreSQL con
 * `.range()` y el total viene del `count` exacto. El navegador solo ve las
 * filas visibles.
 */
export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  rowHref,
  total,
  page,
  pageSize,
  baseParams,
  emptyTitle = 'Sin resultados',
  emptyDescription,
  emptyAction,
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  baseParams?: Record<string, string | undefined>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    Object.entries(baseParams ?? {}).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  };

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-elevated/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-content-muted',
                    alignClass(col.align),
                    col.hideOnMobile && 'hidden md:table-cell',
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={row.id ?? index}
                  className={cn(
                    'border-b border-line last:border-0 transition-colors',
                    href && 'hover:bg-elevated',
                  )}
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 align-middle',
                        alignClass(col.align),
                        col.hideOnMobile && 'hidden md:table-cell',
                      )}
                    >
                      {href && colIndex === 0 ? (
                        // El enlace se ancla a la primera celda: mantiene el
                        // HTML valido (nada de <a> envolviendo un <tr>) y deja
                        // seleccionable el texto del resto de la fila.
                        <Link href={href} className="block font-medium hover:text-accent">
                          {col.cell(row)}
                        </Link>
                      ) : (
                        col.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5">
        <p className="tabular text-2xs text-content-muted">
          {from}–{to} de {total}
        </p>

        {totalPages > 1 ? (
          <nav className="flex items-center gap-1" aria-label="Paginacion">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="btn-ghost px-2 py-1" aria-label="Anterior">
                <ChevronLeft size={15} />
              </Link>
            ) : (
              <span className="btn-ghost px-2 py-1 opacity-30">
                <ChevronLeft size={15} />
              </span>
            )}

            <span className="tabular px-2 text-2xs text-content-secondary">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="btn-ghost px-2 py-1" aria-label="Siguiente">
                <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="btn-ghost px-2 py-1 opacity-30">
                <ChevronRight size={15} />
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
