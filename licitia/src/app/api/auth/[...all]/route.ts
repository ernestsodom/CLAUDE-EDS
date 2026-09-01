import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Handler de better-auth (sign-in, sign-out, sesión, etc.) — solo se usa
// cuando la app corre sobre Neon (DATABASE_URL definida). Sin Neon, el
// login/logout siguen pasando por Supabase Auth y esta ruta no se llama.
export const { GET, POST } = toNextJsHandler(auth());
