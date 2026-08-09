'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Buscador y filtros de tabla.
 *
 * El estado vive en la URL (searchParams), no en React: la paginacion y el
 * filtrado ocurren en el servidor, la vista es compartible por enlace y el
 * boton "atras" del navegador funciona como el usuario espera.
 */
export function TableToolbar({
  placeholder = 'Buscar...',
  filters = [],
  exportHref,
}: {
  placeholder?: string;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  exportHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page'); // cualquier cambio de filtro vuelve a la pagina 1
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce de 300 ms: no se lanza una consulta por pulsacion (§78)
  useEffect(() => {
    if (query === (searchParams.get('q') ?? '')) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams((p) => (query ? p.set('q', query) : p.delete('q')));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, pushParams, searchParams]);

  const hasActiveFilters =
    Boolean(searchParams.get('q')) || filters.some((f) => searchParams.get(f.name));

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[240px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="input pl-9 pr-9"
        />
        {isPending ? (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent"
          />
        ) : null}
      </div>

      {filters.map((filter) => (
        <select
          key={filter.name}
          aria-label={filter.label}
          value={searchParams.get(filter.name) ?? ''}
          onChange={(e) =>
            pushParams((p) =>
              e.target.value ? p.set(filter.name, e.target.value) : p.delete(filter.name),
            )
          }
          className={cn(
            'input w-auto min-w-[150px] cursor-pointer',
            searchParams.get(filter.name) && 'border-accent/50 text-accent',
          )}
        >
          <option value="">{filter.label}: todos</option>
          {filter.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname))}
          className="btn-ghost"
        >
          <X size={14} />
          Limpiar
        </button>
      ) : null}

      {exportHref ? (
        <a href={exportHref} className="btn-secondary ml-auto" download>
          <Download size={14} />
          Exportar CSV
        </a>
      ) : null}
    </div>
  );
}
