import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { asSupabaseClient, hybridAdminClient, useNeon } from "@/lib/db/hybrid";

/**
 * Cliente con service_role — BYPASSA RLS.
 * Uso exclusivo del pipeline de ingesta y tareas de background del servidor.
 * Nunca importar desde código de cliente.
 */
export function createAdminClient() {
  const supabase = createSupabaseClient(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  // Con DATABASE_URL, las consultas pasan a Neon sin identidad —el
  // equivalente al service_role— y los archivos siguen en Supabase hasta la
  // fase 4. Sin la variable, nada cambia.
  return useNeon() ? asSupabaseClient(hybridAdminClient(supabase)) : supabase;
}
