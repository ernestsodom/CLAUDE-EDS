"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Elimina un documento con confirmación en dos pasos: el primer clic pide
 * confirmar, el segundo borra. Un borrado es irreversible (se lleva el
 * archivo, el análisis y los comentarios), así que no basta un clic suelto.
 */
export function DeleteDocumentButton({
  documentId,
  title,
  redirectTo = "/documents",
  onDeleted,
}: {
  documentId: string;
  title: string;
  redirectTo?: string | null;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo eliminar el documento");
      onDeleted?.();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          title={`Eliminar “${title}”`}
        >
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">¿Eliminar definitivamente?</span>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="destructive" size="sm" onClick={remove} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Sí, eliminar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
