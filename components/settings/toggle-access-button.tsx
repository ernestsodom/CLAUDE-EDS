'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldOff, ShieldCheck } from 'lucide-react';
import { setUserAccessActive } from '@/actions/users';

/** Revoca o restaura el acceso de un usuario a este proyecto, sin borrar su cuenta. */
export function ToggleAccessButton({
  projectCode,
  userId,
  active,
}: {
  projectCode: string;
  userId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const confirmMsg = active
      ? '¿Revocar el acceso de este usuario a este proyecto?'
      : '¿Restaurar el acceso de este usuario a este proyecto?';
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    startTransition(async () => {
      const result = await setUserAccessActive(projectCode, userId, !active);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="btn-secondary px-2 py-1 text-2xs"
        title={active ? 'Revocar acceso' : 'Restaurar acceso'}
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : active ? (
          <ShieldOff size={13} />
        ) : (
          <ShieldCheck size={13} />
        )}
      </button>
      {error ? <span className="text-2xs text-critical">{error}</span> : null}
    </span>
  );
}
