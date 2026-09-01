import { createAuthClient } from "better-auth/react";

/**
 * Cliente de better-auth para componentes de cliente ("use client").
 * Sustituye a `supabase.auth.*` en el navegador cuando `NEXT_PUBLIC_USE_NEON`
 * está activo (ver `lib/supabase/client.ts`).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession, getSession } = authClient;
