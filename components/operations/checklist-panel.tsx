'use client';

import { useOptimistic, useTransition, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toggleChecklistItem } from '@/actions/operations';
import { Card, ProgressBar, SectionTitle } from '@/components/ui';
import type { ChecklistItem } from '@/types/database.types';

/**
 * Checklist operacional (§57, §59, §120).
 *
 * Usa `useOptimistic`: la casilla responde al instante y, si el servidor
 * rechaza el cambio (por permisos o RLS), vuelve a su estado real y se
 * muestra el motivo. Nunca se miente al usuario sobre lo que se guardo.
 */
export function ChecklistPanel({
  projectCode,
  title,
  items,
  revalidatePath,
  editable,
}: {
  projectCode: string;
  title: string;
  items: ChecklistItem[];
  revalidatePath: string;
  editable: boolean;
}) {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const [optimistic, setOptimistic] = useOptimistic(
    sorted,
    (state, update: { id: string; completed: boolean }) =>
      state.map((i) => (i.id === update.id ? { ...i, completed: update.completed } : i)),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = optimistic.filter((i) => i.completed).length;
  const pct = optimistic.length > 0 ? (done / optimistic.length) * 100 : 0;

  function toggle(item: ChecklistItem) {
    if (!editable) return;
    setError(null);
    startTransition(async () => {
      setOptimistic({ id: item.id, completed: !item.completed });
      const result = await toggleChecklistItem({
        projectCode,
        itemId: item.id,
        completed: !item.completed,
        revalidate: revalidatePath,
      });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Card>
      <SectionTitle
        action={
          <span className="tabular text-2xs text-content-muted">
            {done}/{optimistic.length}
          </span>
        }
      >
        {title}
      </SectionTitle>

      <ProgressBar value={pct} tone={pct === 100 ? 'success' : 'accent'} className="mb-3" />

      <ul className="space-y-1">
        {optimistic.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item)}
              disabled={!editable || isPending}
              className={cn(
                'flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors',
                editable && 'hover:bg-elevated',
                !editable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  item.completed
                    ? 'border-accent bg-accent text-black'
                    : 'border-line-strong bg-base',
                )}
                aria-hidden
              >
                {item.completed ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              <span
                className={cn(
                  item.completed ? 'text-content-muted line-through' : 'text-content-secondary',
                )}
              >
                {item.title}
                {item.is_required ? null : (
                  <span className="ml-1 text-2xs text-content-muted">(opcional)</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {isPending ? (
        <p className="mt-2 flex items-center gap-1.5 text-2xs text-content-muted">
          <Loader2 size={11} className="animate-spin" /> Guardando...
        </p>
      ) : null}
      {error ? <p className="mt-2 text-2xs text-critical">{error}</p> : null}
    </Card>
  );
}
