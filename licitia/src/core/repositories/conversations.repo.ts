import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentKind } from "@/core/domain/types";
import { NotFoundError } from "@/lib/errors";

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  input: {
    conversationId?: string;
    organizationId: string;
    userId: string;
    documentId: string | null;
    agent: AgentKind;
    firstQuestion: string;
  }
) {
  if (input.conversationId) {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", input.conversationId)
      .single();
    if (!data) throw new NotFoundError("Conversación no encontrada");
    return data;
  }
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      document_id: input.documentId,
      agent: input.agent,
      title: input.firstQuestion.slice(0, 80),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Error creando conversación: ${error?.message}`);
  return data;
}

export async function getHistory(supabase: SupabaseClient, conversationId: string, limit = 20) {
  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).filter((m) => m.role !== "system") as Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export async function appendMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    citations?: unknown;
    confidence?: number | null;
    model?: string;
  }
) {
  await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    citations: input.citations ?? null,
    confidence: input.confidence ?? null,
    model: input.model ?? null,
  });
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);
}

/** Duplica una conversación con todos sus mensajes. */
export async function duplicateConversation(supabase: SupabaseClient, conversationId: string) {
  const { data: original } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (!original) throw new NotFoundError("Conversación no encontrada");

  const { data: copy, error } = await supabase
    .from("conversations")
    .insert({
      organization_id: original.organization_id,
      user_id: original.user_id,
      document_id: original.document_id,
      agent: original.agent,
      title: `${original.title} (copia)`,
      duplicated_from: original.id,
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error(`Error duplicando: ${error?.message}`);

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, citations, confidence, model")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messages?.length) {
    await supabase
      .from("messages")
      .insert(messages.map((m) => ({ ...m, conversation_id: copy.id })));
  }
  return copy.id as string;
}
