import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con service_role — BYPASSA RLS.
 * Uso exclusivo del pipeline de ingesta y tareas de background del servidor.
 * Nunca importar desde código de cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(env().NEXT_PUBLIC_SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
