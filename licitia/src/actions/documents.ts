"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export interface PickedDocumentRow {
  id: string;
  title: string;
  doc_type: string;
  status: string;
}

/** Antes: consulta directa desde `document-picker.tsx` (RLS limitaba a los autorizados). */
export async function searchDocuments(query: string): Promise<PickedDocumentRow[]> {
  const { supabase } = await requireUser();
  let q = supabase
    .from("documents")
    .select("id, title, doc_type, status")
    .is("parent_document_id", null)
    .order("created_at", { ascending: false })
    .limit(8);
  if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
  const { data } = await q;
  return (data ?? []) as PickedDocumentRow[];
}

/** Antes: escritura directa desde `rename-document-button.tsx`. */
export async function renameDocument(documentId: string, title: string): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("documents").update({ title }).eq("id", documentId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Antes: escritura directa desde `move-to-folder-button.tsx`. */
export async function moveDocumentToFolder(
  documentId: string,
  projectId: string | null
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("documents").update({ project_id: projectId }).eq("id", documentId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
