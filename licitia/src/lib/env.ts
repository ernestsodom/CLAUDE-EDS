import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.1"),
  OPENAI_FAST_MODEL: z.string().default("gpt-5.1-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_API_SECRET: z.string().min(16),
  MAX_UPLOAD_MB: z.coerce.number().default(50),
});

let cached: z.infer<typeof serverSchema> | null = null;

/** Valida y expone las variables de entorno del servidor. Falla rápido si falta algo. */
export function env() {
  if (!cached) cached = serverSchema.parse(process.env);
  return cached;
}
