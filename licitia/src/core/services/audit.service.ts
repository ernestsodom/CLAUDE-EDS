import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/** Registra un evento de auditoría. Nunca lanza: la auditoría no debe romper el flujo. */
export async function audit(
  organizationId: string,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: userId,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      detail: detail ?? null,
    });
  } catch (err) {
    logger.warn("audit_failed", { action, error: String(err) });
  }
}
