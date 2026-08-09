'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SessionProject } from '@/types/database.types';

/**
 * Selector de unidad de negocio (§72).
 *
 * El proyecto forma parte de la URL, no de un estado global de cliente:
 * cambiarlo es navegar. Asi cada pantalla es enlazable y el servidor
 * siempre sabe en que proyecto esta el usuario sin depender de React.
 */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: SessionProject;
  projects: SessionProject[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (projects.length <= 1) {
    return (
      <div className="rounded border border-line bg-elevated px-3 py-2">
        <p className="truncate text-sm font-medium">{current.name}</p>
        <p className="text-2xs text-content-muted">{current.default_currency}</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded border border-line bg-elevated px-3 py-2 text-left transition-colors hover:border-line-strong"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{current.name}</span>
          <span className="block text-2xs text-content-muted">
            {current.role ?? '—'} · {current.default_currency}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 text-content-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded border border-line-strong bg-elevated shadow-xl animate-fade-in"
        >
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.id === current.id}
                onClick={() => {
                  setOpen(false);
                  router.push(`/${p.code}/dashboard`);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
              >
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-2xs text-content-muted">
                    {p.role ?? '—'} · {p.default_currency}
                  </span>
                </span>
                {p.id === current.id ? (
                  <Check size={14} className="shrink-0 text-accent" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
