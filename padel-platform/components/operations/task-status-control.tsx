'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTaskStatus } from '@/actions/operations';

const OPTIONS = ['PENDIENTE', 'EN_CURSO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA'] as const;

export function TaskStatusControl({
  projectCode, taskId, status,
}: { projectCode: string; taskId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="Estado de la tarea"
      value={status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateTaskStatus({ projectCode, taskId, status: e.target.value });
          router.refresh();
        })
      }
      className="input w-auto py-1 text-2xs"
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}
