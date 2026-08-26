"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

/**
 * Historial de conversaciones del Chat IA de ESTE documento — las mismas
 * que ya se guardan en la base de datos en cada turno (conversations +
 * messages), pero hasta ahora invisibles: el chat siempre arrancaba en
 * blanco al reabrir el documento aunque la conversación anterior seguía
 * ahí. Reabrir una la retoma tal cual quedó; "Nueva conversación" empieza
 * una en blanco sin perder las anteriores.
 */
export function DocumentChatHistory({
  documentId,
  conversations,
  activeId,
}: {
  documentId: string;
  conversations: Conversation[];
  activeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (c: string) => {
    setOpen(false);
    router.push(`/documents/${documentId}?c=${c}`);
  };

  return (
    <div className="relative inline-block">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <History className="h-3.5 w-3.5" />
        Historial{conversations.length > 0 && ` (${conversations.length})`}
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-80 space-y-1 rounded-lg border bg-card p-2 text-left shadow-md">
            <button
              type="button"
              onClick={() => go("new")}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Nueva conversación
            </button>
            {conversations.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Sin conversaciones anteriores en este documento.
              </p>
            ) : (
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => go(c.id)}
                      className={cn(
                        "w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                        activeId === c.id && "bg-primary/10 font-medium"
                      )}
                    >
                      <span className="block truncate">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(c.updated_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
