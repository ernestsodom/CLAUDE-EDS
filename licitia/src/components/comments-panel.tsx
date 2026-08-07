"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2, X, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export interface CommentAttachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface Comment {
  id: string;
  kind: string;
  content: string;
  due_date: string | null;
  resolved: boolean;
  created_at: string;
  note_attachments?: CommentAttachment[];
}

const KINDS = ["comentario", "observacion", "pendiente", "recordatorio"];

const formatSize = (bytes: number | null) =>
  bytes == null ? "" : bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Comentarios del documento, con archivos adjuntos.
 *
 * El comentario se crea primero y los adjuntos se suben después contra su id:
 * así el adjunto siempre cuelga de una fila existente y la política de Storage
 * puede verificar la organización en la ruta.
 */
export function CommentsPanel({
  documentId,
  initialComments,
}: {
  documentId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("comentario");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addComment() {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: dbError } = await supabase
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

    if (dbError || !data) {
      setError(dbError?.message ?? "No se pudo guardar el comentario");
      setBusy(false);
      return;
    }

    const attachments: CommentAttachment[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/notes/${data.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(`«${file.name}»: ${json.error?.message ?? "no se pudo adjuntar"}`);
        continue;
      }
      attachments.push(json as CommentAttachment);
    }

    setComments((prev) => [{ ...(data as Comment), note_attachments: attachments }, ...prev]);
    setContent("");
    setDueDate("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
  }

  async function toggleResolved(comment: Comment) {
    const supabase = createClient();
    await supabase.from("notes").update({ resolved: !comment.resolved }).eq("id", comment.id);
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, resolved: !c.resolved } : c))
    );
  }

  async function openAttachment(attachmentId: string) {
    const res = await fetch(`/api/notes/attachments/${attachmentId}`);
    const json = await res.json();
    if (res.ok && json.url) window.open(json.url, "_blank", "noopener,noreferrer");
    else setError(json.error?.message ?? "No se pudo abrir el adjunto");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-4">
        <Textarea
          placeholder="Escribe un comentario…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-48 truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Quitar ${f.name}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Tipo de comentario"
          >
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {(kind === "pendiente" || kind === "recordatorio") && (
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Fecha de vencimiento"
            />
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" /> Adjuntar archivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
          />
          <Button size="sm" onClick={addComment} disabled={busy || !content.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Agregar
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{c.kind}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                {c.due_date && (
                  <span className="text-xs text-amber-600">vence {formatDate(c.due_date)}</span>
                )}
              </div>
              <p className={c.resolved ? "text-muted-foreground line-through" : ""}>{c.content}</p>
              {(c.note_attachments ?? []).length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {(c.note_attachments ?? []).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => openAttachment(a.id)}
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Download className="h-3 w-3" />
                        <span className="max-w-56 truncate">{a.file_name}</span>
                        <span className="text-muted-foreground">{formatSize(a.size_bytes)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(c.kind === "pendiente" || c.kind === "recordatorio") && (
              <Button variant="ghost" size="sm" onClick={() => toggleResolved(c)}>
                {c.resolved ? "Reabrir" : "Resolver"}
              </Button>
            )}
          </li>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin comentarios aún.</p>
        )}
      </ul>
    </div>
  );
}
