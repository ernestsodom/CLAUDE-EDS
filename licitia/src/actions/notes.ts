"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

/**
 * Server Actions para comentarios de documentos (antes: escritura directa
 * desde `comments-panel.tsx` contra Supabase con la anon key). `requireUser()`
 * decide sola contra qué base habla —Supabase o Neon— así que esta acción
 * funciona igual en los dos modos, sin que el componente lo sepa.
 */

export interface CommentResult {
  id: string;
  kind: string;
  content: string;
  due_date: string | null;
  resolved: boolean;
  created_at: string;
}

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export async function addComment(
  documentId: string,
  input: { kind: string; content: string; dueDate: string | null }
): Promise<ActionResult<CommentResult>> {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        document_id: documentId,
        user_id: user.id,
        kind: input.kind,
        content: input.content.trim(),
        due_date: input.dueDate || null,
      })
      .select("*")
      .single();
    if (error || !data) return { data: null, error: error?.message ?? "No se pudo guardar el comentario" };
    return { data: data as CommentResult, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

export async function toggleNoteResolved(
  noteId: string,
  resolved: boolean
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("notes").update({ resolved }).eq("id", noteId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
