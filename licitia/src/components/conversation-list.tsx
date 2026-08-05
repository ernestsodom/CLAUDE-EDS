"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star, Copy, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  agent: string;
  is_favorite: boolean;
  updated_at: string;
  document_id: string | null;
}

/** Historial de conversaciones: buscar, reabrir, duplicar y marcar favoritas. */
export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: Conversation[];
  activeId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(conversations);

  const filtered = items.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  async function toggleFavorite(c: Conversation) {
    const supabase = createClient();
    await supabase.from("conversations").update({ is_favorite: !c.is_favorite }).eq("id", c.id);
    setItems((prev) =>
      prev.map((i) => (i.id === c.id ? { ...i, is_favorite: !i.is_favorite } : i))
    );
  }

  async function duplicate(c: Conversation) {
    const res = await fetch(`/api/conversations/${c.id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (res.ok) router.push(`/chat?c=${json.conversationId}`);
  }

  const sorted = [...filtered].sort(
    (a, b) => Number(b.is_favorite) - Number(a.is_favorite) ||
      b.updated_at.localeCompare(a.updated_at)
  );

  return (
    <aside className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar conversaciones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => router.push("/chat")} title="Nueva conversación">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ul className="max-h-[62vh] space-y-1 overflow-y-auto">
        {sorted.map((c) => (
          <li
            key={c.id}
            className={cn(
              "group rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              activeId === c.id && "bg-primary/10"
            )}
          >
            <div className="flex items-center gap-1">
              <Link href={`/chat?c=${c.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.agent} · {formatDate(c.updated_at)}
                </p>
              </Link>
              <button
                onClick={() => toggleFavorite(c)}
                title="Favorita"
                className={cn(
                  "opacity-0 transition-opacity group-hover:opacity-100",
                  c.is_favorite && "opacity-100"
                )}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    c.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                  )}
                />
              </button>
              <button
                onClick={() => duplicate(c)}
                title="Duplicar"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </li>
        ))}
        {sorted.length === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">Sin conversaciones.</p>
        )}
      </ul>
    </aside>
  );
}
