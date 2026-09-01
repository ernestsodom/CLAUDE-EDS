"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes de cliente (anon key + sesión del usuario). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Espejo, en el navegador, de `useNeon()` (`lib/db/hybrid.ts`). El servidor
 * decide por `DATABASE_URL` —una variable que nunca llega al cliente—, así
 * que aquí hace falta una pública equivalente. Debe activarse a la vez que
 * `DATABASE_URL` (fase 3: login/logout pasan a better-auth); si quedan
 * desincronizadas, el navegador cree usar Supabase Auth mientras el
 * servidor ya espera sesiones de better-auth, o viceversa.
 */
export function useNeonClient(): boolean {
  return process.env.NEXT_PUBLIC_USE_NEON === "1";
}
