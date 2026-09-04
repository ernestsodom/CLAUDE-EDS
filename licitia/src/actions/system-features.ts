"use server";

import { requireUser } from "@/lib/supabase/server";
import { getChecklist } from "@/core/repositories/checklist.repo";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export interface SystemFeatureCount {
  id: string;
  name: string;
  featureCount: number;
}

/**
 * Cuántas funcionalidades tiene guardadas cada sistema del documento —
 * para que el comparador sepa, sin bajar el detalle completo, a cuáles
 * pedirles funcionalidades antes de comparar.
 */
export async function getSystemFeatureCounts(documentId: string): Promise<ActionResult<SystemFeatureCount[]>> {
  try {
    const { supabase } = await requireUser();
    const rows = await getChecklist(supabase, documentId);
    return {
      data: rows.map((s) => ({ id: s.id, name: s.name, featureCount: s.features.length })),
      error: null,
    };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Antes: escritura directa desde `systems-checklist.tsx`. */
export async function toggleSystemFeature(
  featureId: string,
  completed: boolean
): Promise<ActionResult<{ completedAt: string | null }>> {
  try {
    const { supabase, user } = await requireUser();
    const completedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("system_features")
      .update({
        is_completed: completed,
        completed_at: completedAt,
        completed_by: completed ? user.id : null,
      })
      .eq("id", featureId);
    if (error) return { data: null, error: error.message };
    return { data: { completedAt }, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

export async function setSystemFeatureDeadline(
  featureId: string,
  deadlineDate: string | null
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("system_features")
      .update({ deadline_date: deadlineDate })
      .eq("id", featureId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
