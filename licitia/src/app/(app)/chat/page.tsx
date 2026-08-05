import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat-panel";
import { ConversationList } from "@/components/conversation-list";
import type { AgentKind } from "@/core/domain/types";

export const metadata = { title: "Chat IA" };
export const dynamic = "force-dynamic";

const AGENTS: Array<{ id: AgentKind; label: string }> = [
  { id: "analista", label: "Analista de Licitaciones" },
  { id: "comparador", label: "Comparador de Cumplimiento" },
  { id: "reclamos", label: "Redactor de Reclamos" },
  { id: "propuestas", label: "Generador de Propuestas" },
  { id: "comercial", label: "Asesor Comercial" },
];

/** Chat sobre toda la biblioteca de conocimiento, con agentes especializados
 *  e historial de conversaciones (reabrir, continuar, duplicar, favoritas). */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; agente?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const agent = (params.agente as AgentKind) ?? "analista";

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, agent, is_favorite, updated_at, document_id")
    .order("updated_at", { ascending: false })
    .limit(50);

  let initialMessages: Array<{
    role: "user" | "assistant";
    content: string;
    citations?: never[];
    confidence?: number | null;
  }> = [];
  if (params.c) {
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content, citations, confidence")
      .eq("conversation_id", params.c)
      .order("created_at", { ascending: true });
    initialMessages = (messages ?? []).filter((m) => m.role !== "system") as never;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <ConversationList conversations={conversations ?? []} activeId={params.c} />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {AGENTS.map((a) => (
            <Link
              key={a.id}
              href={`/chat?agente=${a.id}`}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                agent === a.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>
        <ChatPanel
          key={`${params.c ?? "new"}-${agent}`}
          documentId={null}
          agent={agent}
          initialConversationId={params.c}
          initialMessages={initialMessages}
          placeholder="Pregunta a toda la biblioteca… p.ej. ¿Qué licitaciones exigen firma electrónica?"
        />
      </div>
    </div>
  );
}
