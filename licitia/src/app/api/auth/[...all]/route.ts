import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Handler de better-auth (sign-in, sign-out, sesión, etc.) — solo se usa
// cuando la app corre sobre Neon (DATABASE_URL definida). Sin Neon, el
// login/logout siguen pasando por Supabase Auth y esta ruta no se llama.
//
// `auth()` se construye recién al llegar la petición (no al cargar el
// módulo): `next build` ejecuta esta ruta en frío, sin variables de
// entorno de runtime, para recolectar sus metadatos — construirla antes
// rompería el build en cualquier entorno sin DATABASE_URL, Neon o no.
export async function GET(request: Request) {
  return toNextJsHandler(auth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(auth()).POST(request);
}
