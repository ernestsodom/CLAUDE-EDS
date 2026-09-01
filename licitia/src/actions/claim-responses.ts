"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

/** Antes: escritura directa desde `claim-responses.tsx`. */
export async function saveClaimResponse(responseId: string, content: string): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("claim_responses").update({ content }).eq("id", responseId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

export async function toggleClaimResponseApproval(
  responseId: string,
  approved: boolean
): Promise<ActionResult<true>> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("claim_responses")
      .update({ approved, approved_by: approved ? user.id : null })
      .eq("id", responseId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
