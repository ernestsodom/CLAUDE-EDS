'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { setProjectModule } from '@/actions/settings';

/**
 * Modulos del proyecto.
 *
 * Cada interruptor decide si una seccion aparece o no en el menu. Es la
 * herramienta con la que un proyecto se ajusta a como trabaja de verdad:
 * apagar lo que no usa no borra nada, solo deja de mostrarlo.
 */
export function ModuleToggles({
  projectCode,
  modules,
  editable,
}: {
  projectCode: string;
  modules: { module_code: string; enabled: boolean; name: string; category: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(moduleCode: string, enabled: boolean) {
    setError(null);
    setPendingCode(moduleCode);
    startTransition(async () => {
      const result = await setProjectModule(projectCode, moduleCode, enabled);
      setPendingCode(null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {modules.map((m) => (
          <li key={m.module_code} className="flex items-center gap-2 text-sm">
            {editable ? (
              <input
                id={`mod-${m.module_code}`}
                type="checkbox"
                checked={m.enabled}
                disabled={isPending}
                onChange={(e) => toggle(m.module_code, e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[rgb(255,90,0)]"
              />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${m.enabled ? 'bg-success' : 'bg-line-strong'}`} />
            )}
            <label
              htmlFor={`mod-${m.module_code}`}
              className={m.enabled ? 'text-content-secondary' : 'text-content-muted line-through'}
            >
              {m.name}
            </label>
            {pendingCode === m.module_code ? (
              <Loader2 size={12} className="animate-spin text-content-muted" />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
