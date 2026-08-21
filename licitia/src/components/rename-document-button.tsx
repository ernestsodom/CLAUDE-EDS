"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Renombra un documento en el sitio: un lápiz que despliega un campo de
 * texto con el título actual. Escritura directa contra Supabase (la misma
 * política que ya protege documents_update), sin ruta de API de por medio.
 */
export function RenameDocumentButton({
  documentId,
  title,
  onRenamed,
}: {
  documentId: string;
  title: string;
  /** Si se pasa, se usa en vez de router.refresh() (p.ej. actualizar una fila en memoria). */
  onRenamed?: (newTitle: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setValue(title);
    setError(null);
    setEditing(true);
    // El input aún no existe en este mismo tick; foco en el siguiente frame.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: dbError } = await createClient()
      .from("documents")
      .update({ title: trimmed })
      .eq("id", documentId);
    setBusy(false);
    if (dbError) {
      setError("No se pudo guardar el nombre");
      return;
    }
    setEditing(false);
    if (onRenamed) onRenamed(trimmed);
    else router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        title="Renombrar documento"
        aria-label="Renombrar documento"
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={busy}
        className="h-7 max-w-xs text-sm"
        aria-label="Nuevo nombre del documento"
      />
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setEditing(false)}
        disabled={busy}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
