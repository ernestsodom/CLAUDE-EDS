"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

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
