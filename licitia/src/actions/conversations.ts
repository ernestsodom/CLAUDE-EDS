"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

/** Antes: escritura directa desde `conversation-list.tsx`. */
export async function toggleConversationFavorite(
  id: string,
  favorite: boolean
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("conversations").update({ is_favorite: favorite }).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
