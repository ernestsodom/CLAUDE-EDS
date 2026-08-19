import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { ProviderId } from "@/lib/ai-providers";

// ============================================================================
// Registro de consumo real de IA: cada llamado a structuredCompletion,
// textCompletion o al chat en streaming reporta aquí los tokens que el
// propio proveedor devolvió en su respuesta (nunca estimados a partir del
// texto) — es la única fuente de verdad de cuánto se ha usado cada motor
// dentro de LicitIA. Ver ai-usage-pricing.ts para el costo en USD.
// ============================================================================

/** Etapa o función que generó el consumo — para poder ver en qué se va la cuota. */
export type UsageFeature =
  | "clasificacion"
  | "resumen"
  | "sistemas"
  | "requerimientos"
  | "timeline"
  | "chat"
  | "comparacion_cumplimiento"
  | "comparacion_diff"
  | "reclamo_analisis"
  | "reclamo_respuesta";

export const FEATURE_LABELS: Record<UsageFeature, string> = {
  clasificacion: "Clasificación",
  resumen: "Resumen ejecutivo",
  sistemas: "Sistemas y funcionalidades",
  requerimientos: "Puntos críticos",
  timeline: "Línea de tiempo",
  chat: "Chat IA",
  comparacion_cumplimiento: "Comparador · cumplimiento",
  comparacion_diff: "Comparador · diferencias",
  reclamo_analisis: "Reclamos · análisis",
  reclamo_respuesta: "Reclamos · respuesta",
};

export interface UsageEvent {
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LogUsageInput extends UsageEvent {
  organizationId: string;
  feature: UsageFeature;
  documentId?: string | null;
  userId?: string | null;
}

/**
 * Registra un consumo. Nunca debe frenar el flujo principal si falla — es
 * solo medición, no algo de lo que dependa el análisis — así que absorbe
 * cualquier error y lo deja en el log de la app.
 */
export async function logAiUsage(input: LogUsageInput): Promise<void> {
  if (input.inputTokens <= 0 && input.outputTokens <= 0) return;
  try {
    const db = createAdminClient();
    const { error } = await db.from("ai_usage_log").insert({
      organization_id: input.organizationId,
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      document_id: input.documentId ?? null,
      created_by: input.userId ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    logger.warn("ai_usage_log_failed", {
      provider: input.provider,
      feature: input.feature,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Crea el callback que analysis.service.ts / comparison.service.ts / etc.
 *  pasan a structuredCompletion/textCompletion: ya trae organización,
 *  feature y documento fijos, así cada call site no repite ese boilerplate. */
export function usageLogger(
  ctx: Omit<LogUsageInput, keyof UsageEvent>
): (u: UsageEvent) => void {
  return (u) => {
    void logAiUsage({ ...ctx, ...u });
  };
}
