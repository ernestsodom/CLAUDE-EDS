import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UnauthorizedError } from "@/lib/errors";

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

/** Devuelve el usuario autenticado y su perfil, o lanza 401. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.is_active) throw new UnauthorizedError("Perfil inactivo o inexistente");

  return { supabase, user, profile };
}
