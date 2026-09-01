"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

/** Antes: escritura directa desde `move-comparison-button.tsx`. */
export async function moveComparisonToFolder(
  comparisonId: string,
  projectId: string | null,
  folderId: string | null
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("comparisons")
      .update({ project_id: projectId, folder_id: folderId })
      .eq("id", comparisonId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
