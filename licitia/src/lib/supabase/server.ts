import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UnauthorizedError } from "@/lib/errors";
import { asSupabaseClient, hybridUserClient, useNeon } from "@/lib/db/hybrid";

/**
 * Cliente de Supabase para Server Components / Route Handlers / Server Actions.
 * Ejecuta con la sesión del usuario → RLS aplica en cada consulta.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>
        ) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll desde un Server Component: ignorable, el middleware refresca la sesión
          }
        },
      },
    }
  );
}

/**
 * Devuelve el usuario autenticado y su perfil, o lanza 401.
 *
 * El `supabase` que devuelve es, cuando `DATABASE_URL` está configurada, el
 * cliente de transición: las consultas van a Neon con la identidad del
 * usuario —así siguen aplicando las 65 políticas RLS— y los archivos siguen
 * en Supabase hasta la fase 4. Sin esa variable, todo va a Supabase como
 * hasta ahora, así que desplegar este cambio no altera nada por sí solo.
 *
 * La sesión la sigue resolviendo Supabase Auth (fase 3).
 */
export async function requireUser() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const supabase = useNeon()
    ? asSupabaseClient(hybridUserClient(authClient, user.id))
    : authClient;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.is_active) throw new UnauthorizedError("Perfil inactivo o inexistente");

  return { supabase, user, profile };
}
