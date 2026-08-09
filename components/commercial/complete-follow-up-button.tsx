'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { completeFollowUp } from '@/actions/crm';

export function CompleteFollowUpButton({
  projectCode, followUpId,
}: { projectCode: string; followUpId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        className="btn-ghost px-2 py-1 text-2xs"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await completeFollowUp({ projectCode, followUpId });
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Completar
      </button>
      {error ? <span className="ml-2 text-2xs text-critical">{error}</span> : null}
    </>
  );
}
