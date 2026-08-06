import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  // Proveedor principal (compatible con la API de OpenAI: Gemini, la propia
  // OpenAI, Mistral…). Opcional para permitir despliegues que solo usen el
  // segundo proveedor y/o el motor local — cada uso real se valida con
  // isProviderConfigured() en lib/ai-providers.ts, con un error claro.
  OPENAI_API_KEY: z.string().min(10).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5.1"),
  OPENAI_FAST_MODEL: z.string().default("gpt-5.1-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  // Debe coincidir con vector(1536) de la migración SQL. Proveedores con otra
  // dimensión nativa (p.ej. gemini-embedding-001) la ajustan con este valor.
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().optional(),

  // Segundo proveedor de IA (Groq: nivel gratuito generoso, sin tarjeta).
  // Sin embeddings ni OCR — se usa para clasificar/resumir/extraer cuando
  // el proveedor principal se queda sin cuota, o por elección explícita.
  GROQ_API_KEY: z.string().min(10).optional(),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_CHAT_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_FAST_MODEL: z.string().default("llama-3.1-8b-instant"),

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
