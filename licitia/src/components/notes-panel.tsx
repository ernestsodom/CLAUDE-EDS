"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Note {
  id: string;
  kind: string;
  content: string;
  due_date: string | null;
  resolved: boolean;
  created_at: string;
}

const KINDS = ["comentario", "observacion", "pendiente", "recordatorio"];

/** Notas del documento: comentarios, observaciones, pendientes y recordatorios. */
export function NotesPanel({
  documentId,
  initialNotes,
}: {
  documentId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("comentario");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function addNote() {
    if (!content.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        document_id: documentId,
        user_id: user!.id,
        kind,
        content: content.trim(),
        due_date: dueDate || null,
      })
      .select("*")
      .single();
    if (!error && data) {
      setNotes((prev) => [data as Note, ...prev]);
      setContent("");
      setDueDate("");
    }
    setBusy(false);
  }

  async function toggleResolved(note: Note) {
    const supabase = createClient();
    await supabase.from("notes").update({ resolved: !note.resolved }).eq("id", note.id);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, resolved: !n.resolved } : n)));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-4">
        <Textarea
          placeholder="Escribe una nota…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {(kind === "pendiente" || kind === "recordatorio") && (
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          )}
          <Button size="sm" onClick={addNote} disabled={busy || !content.trim()}>
            Agregar
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{n.kind}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                {n.due_date && (
                  <span className="text-xs text-amber-600">vence {formatDate(n.due_date)}</span>
                )}
              </div>
              <p className={n.resolved ? "text-muted-foreground line-through" : ""}>{n.content}</p>
            </div>
            {(n.kind === "pendiente" || n.kind === "recordatorio") && (
              <Button variant="ghost" size="sm" onClick={() => toggleResolved(n)}>
                {n.resolved ? "Reabrir" : "Resolver"}
              </Button>
            )}
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-muted-foreground">Sin notas aún.</p>}
      </ul>
    </div>
  );
}
