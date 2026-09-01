import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminDbClient, createDbClient, type DbClient } from "./index";

/**
 * Cliente de transición: datos en Neon, con `.storage`/`.auth` de Supabase
 * disponibles como respaldo.
 *
 * Migrar un sistema vivo por partes exige que las partes convivan. Aquí las
 * consultas (`.from`, `.rpc`) ya van a Neon. `.storage` sigue siendo el de
 * Supabase, pero desde la fase 4 los cinco puntos que suben/descargan
 * documentos y adjuntos (`lib/storage.ts`, `lib/upload-document.ts`) miran
 * primero `useBlobStorage()`: si `BLOB_READ_WRITE_TOKEN` está puesta, van a
 * Vercel Blob y ni tocan este `.storage`; si no, caen aquí, a Supabase,
 * exactamente como antes. `.auth` no lo usa nadie ya (fase 3): sigue
 * expuesto solo porque `SupabaseClient["storage"]`/`["auth"]` completan el
 * tipo que finge `asSupabaseClient()`.
 *
 * Cambiar datos, archivos y autenticación a la vez habría significado una
 * única entrega enorme, imposible de verificar por partes y de revertir si
 * algo falla.
 *
 * El interruptor de esta capa es `DATABASE_URL`: si no está, todo sigue
 * yendo a Supabase exactamente como hasta ahora. Nada cambia de
 * comportamiento hasta que esa variable existe.
 */

export interface HybridClient extends DbClient {
  /** Respaldo de Supabase: activo cuando `useBlobStorage()` es falso. */
  storage: SupabaseClient["storage"];
  auth: SupabaseClient["auth"];
}

export function useNeon(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Datos por Neon con la identidad del usuario (RLS aplica); archivos por Supabase. */
export function hybridUserClient(supabase: SupabaseClient, userId: string): HybridClient {
  const db = createDbClient(userId);
  return {
    from: db.from.bind(db),
    rpc: db.rpc.bind(db),
    storage: supabase.storage,
    auth: supabase.auth,
  };
}

/** Datos por Neon sin identidad (ingesta y tareas de fondo); archivos por Supabase. */
export function hybridAdminClient(supabase: SupabaseClient): HybridClient {
  const db = createAdminDbClient();
  return {
    from: db.from.bind(db),
    rpc: db.rpc.bind(db),
    storage: supabase.storage,
    auth: supabase.auth,
  };
}

/**
 * Presenta el cliente híbrido con el tipo de supabase-js.
 *
 * Es una conversión deliberada y está aislada aquí, en un único punto, en
 * vez de repartida por el código. La alternativa —cambiar la firma de los
 * 8 servicios y repositorios a un tipo común— obligaba a que el encadenado
 * `.select().eq()` quedara sin tipar, y eso propagaba `any` a 9 archivos y
 * 23 lugares que hoy sí están comprobados. Peor negocio: se pierde tipado
 * real a cambio de tipar una transición.
 *
 * Lo que sostiene esta conversión no es la confianza, son dos hechos
 * comprobados: la aplicación solo usa `from`, `rpc`, `storage` y `auth`
 * (verificado sobre el código: cero usos de channel, realtime, functions,
 * schema o rest), y el comportamiento de `from`/`rpc` está cubierto por 19
 * pruebas contra una base real.
 *
 * Cuando termine la migración esto desaparece: el cliente pasa a ser el
 * único y los servicios declaran su propio tipo.
 */
export function asSupabaseClient(client: HybridClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}
