"use client";

import { useRef, useState } from "react";
import { Send, Loader2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentKind } from "@/core/domain/types";

interface ChatCitation {
  chunk_id: string;
  cita_textual: string;
  pagina: number | null;
  seccion: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  confidence?: number | null;
}

/**
 * Panel de chat RAG con streaming SSE. Muestra citas (página/sección)
 * y nivel de confianza bajo cada respuesta del asistente.
 */
export function ChatPanel({
  documentId,
  agent = "analista",
  initialConversationId,
  initialMessages = [],
  placeholder = "Pregunta sobre el documento… p.ej. ¿Qué multas contempla?",
}: {
  documentId: string | null;
  agent?: AgentKind;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | undefined>(initialConversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationRef.current,
          documentId,
          agent,
          question,
        }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Error en el chat");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const applyEvent = (event: string, data: Record<string, unknown>) => {
        if (event === "meta") conversationRef.current = data.conversationId as string;
        if (event === "delta") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: next[next.length - 1].content + (data.text as string),
            };
            return next;
          });
        }
        if (event === "done") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              citations: data.citations as ChatCitation[],
              confidence: data.confidence as number | null,
            };
            return next;
          });
        }
        if (event === "error") throw new Error(String(data.message));
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const eventMatch = block.match(/^event: (.+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (eventMatch && dataMatch) applyEvent(eventMatch[1], JSON.parse(dataMatch[1]));
        }
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Error inesperado"}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div className="max-w-md space-y-2">
              <p className="font-medium text-foreground">Asistente IA con citas verificables</p>
              <p>
                Ejemplos: “¿Qué sistemas solicita esta licitación?”, “¿Qué plazos tiene?”,
                “¿Qué multas contempla?”, “¿Qué garantías solicita?”
              </p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              <p className="whitespace-pre-wrap">{m.content || (busy && i === messages.length - 1 ? "…" : "")}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t pt-2">
                  {m.citations.map((c, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        “{c.cita_textual}”{" "}
                        <span className="font-medium">
                          {c.pagina != null && `pág. ${c.pagina}`}
                          {c.seccion && ` · ${c.seccion}`}
                        </span>
                      </span>
                    </div>
                  ))}
                  {m.confidence != null && (
                    <Badge variant={m.confidence >= 0.7 ? "success" : m.confidence >= 0.4 ? "warning" : "danger"}>
                      Confianza: {(m.confidence * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="min-h-[44px] resize-none"
          rows={1}
        />
        <Button onClick={send} disabled={busy || !input.trim()} size="icon" aria-label="Enviar">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
