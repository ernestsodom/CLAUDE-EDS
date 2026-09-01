import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { UnauthorizedError } from "@/lib/errors";
import { asSupabaseClient, hybridUserClient, useNeon } from "@/lib/db/hybrid";
import { auth } from "@/lib/auth";

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
 * Con `DATABASE_URL` configurada (Neon), la sesión la resuelve better-auth
 * (fase 3) y las consultas van a Neon con la identidad del usuario —así
 * siguen aplicando las 65 políticas RLS, que no cambiaron ni una línea:
 * siguen leyendo `app.user_id`, solo cambió quién decide ese id. Sin esa
 * variable, todo sigue en Supabase (Auth + datos) como hasta ahora, así que
 * desplegar este cambio no altera nada por sí solo.
 *
 * Los archivos siguen en Supabase Storage hasta la fase 4 en ambos casos.
 */
export async function requireUser() {
  if (useNeon()) {
    const session = await auth().api.getSession({ headers: await headers() });
    if (!session) throw new UnauthorizedError();
    const user = { id: session.user.id, email: session.user.email as string | null };

    const supabase = asSupabaseClient(hybridUserClient(await createClient(), user.id));
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (!profile || !profile.is_active) throw new UnauthorizedError("Perfil inactivo o inexistente");

    return { supabase, user, profile };
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data: profile } = await authClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.is_active) throw new UnauthorizedError("Perfil inactivo o inexistente");

  return { supabase: authClient, user, profile };
}
