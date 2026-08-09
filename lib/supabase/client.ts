'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para el navegador. Solo ANON KEY: RLS aplica.
 * Se usa para login/logout y para suscripciones realtime.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
