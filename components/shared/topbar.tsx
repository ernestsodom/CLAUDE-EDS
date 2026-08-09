'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { initials } from '@/lib/format';
import type { SessionUser } from '@/types/database.types';

export function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-line bg-base/80 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-2.5">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium leading-tight">{user.full_name ?? user.email}</p>
          <p className="text-2xs leading-tight text-content-muted">
            {user.is_super_admin ? 'Super admin' : user.email}
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
          aria-hidden
        >
          {initials(user.full_name ?? user.email)}
        </div>
      </div>

      <button
        type="button"
        onClick={signOut}
        disabled={signingOut || isPending}
        className="btn-ghost"
        aria-label="Cerrar sesion"
      >
        {signingOut || isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <LogOut size={16} />
        )}
      </button>
    </header>
  );
}
