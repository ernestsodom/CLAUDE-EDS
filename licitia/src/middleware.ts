import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { useNeon } from "@/lib/db/hybrid";

const PUBLIC_PATHS = ["/login", "/auth", "/api/internal", "/api/auth"];

/**
 * Middleware de autenticación: protege todas las rutas de la aplicación
 * excepto las públicas.
 *
 * Con Neon (fase 3), la comprobación es la que recomienda better-auth para
 * middleware: `getSessionCookie()` solo mira que exista una cookie de sesión
 * con forma válida, sin tocar la base de datos (el runtime de middleware no
 * es buen lugar para eso). Es una redirección optimista, no la autorización
 * real — esa la sigue haciendo `requireUser()` en cada Server
 * Component/Route Handler, que si la sesión resultara inválida o expirada
 * responde 401 igual.
 *
 * Sin Neon, sigue igual que siempre: Supabase Auth refresca la sesión aquí.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (useNeon()) {
    const hasSession = Boolean(getSessionCookie(request));

    if (!hasSession && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (hasSession && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>
        ) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)).*)"],
};
