'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
      Cerrar sesion
    </button>
  );
}
