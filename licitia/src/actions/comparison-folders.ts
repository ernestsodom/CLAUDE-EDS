"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export interface ComparisonFolderRow {
  id: string;
  name: string;
}

/** Antes: consulta directa desde `comparison-folder-picker.tsx`. */
export async function listComparisonFolders(projectId: string): Promise<ComparisonFolderRow[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("comparison_folders")
    .select("id, name")
    .eq("project_id", projectId)
    .order("name");
  return (data ?? []) as ComparisonFolderRow[];
}

/** Antes: escritura directa desde `comparison-folder-picker.tsx`. */
export async function createComparisonFolder(
  projectId: string,
  name: string
): Promise<ActionResult<ComparisonFolderRow>> {
  try {
    const { supabase, user, profile } = await requireUser();
    const { data: folder, error } = await supabase
      .from("comparison_folders")
      .insert({
        organization_id: profile.organization_id,
        project_id: projectId,
        name: name.trim(),
        created_by: user.id,
      })
      .select("id, name")
      .single();
    if (error) {
      return {
        data: null,
        error: error.message.includes("duplicate")
          ? "Ya existe una subcarpeta con ese nombre en esta carpeta."
          : `Error creando subcarpeta: ${error.message}`,
      };
    }
    return { data: folder as ComparisonFolderRow, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
