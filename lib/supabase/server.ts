import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase para Server Components y Server Actions.
 *
 * Usa la ANON KEY y la sesion del usuario: **RLS aplica**. Es el cliente
 * por defecto y el que debe usarse en el 99% de los casos.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies. El refresco
            // de sesion lo realiza el middleware, asi que se puede ignorar.
          }
        },
      },
    },
  );
}

/**
 * Cliente con SERVICE ROLE: **bypasea RLS**.
 *
 * Uso permitido, y solo server-side:
 *   - motor de alertas / jobs programados
 *   - generacion de signed URLs de Storage
 *   - administracion de usuarios
 *
 * Nunca debe alcanzarse desde un Client Component. El import de
 * 'server-only' al inicio del modulo hace que el build falle si alguien
 * lo intenta, en lugar de filtrar la clave en un bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no esta configurada. Solo debe existir en el entorno del servidor.',
    );
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
