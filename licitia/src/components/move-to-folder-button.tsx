"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderInput, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/components/project-picker";

/**
 * Mueve un documento a otra carpeta (o lo saca de todas, "Sin carpeta"):
 * reutiliza ProjectPicker, que ya trae la lista de carpetas y permite crear
 * una nueva al vuelo.
 */
export function MoveToFolderButton({
  documentId,
  currentProjectId,
  onMoved,
}: {
  documentId: string;
  currentProjectId: string | null;
  onMoved?: (newProjectId: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(currentProjectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const { error: dbError } = await createClient()
      .from("documents")
      .update({ project_id: projectId })
      .eq("id", documentId);
    setBusy(false);
    if (dbError) {
      setError("No se pudo mover el documento");
      return;
    }
    setOpen(false);
    if (onMoved) onMoved(projectId);
    else router.refresh();
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setProjectId(currentProjectId);
          setError(null);
          setOpen(!open);
        }}
        title="Mover a otra carpeta"
      >
        <FolderInput className="h-4 w-4" /> Mover
      </Button>

      {open && (
        <>
          {/* Capa transparente para cerrar al hacer click afuera, sin depender
              de una librería de popovers. */}
          <button
            type="button"
            aria-label="Cerrar"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-80 space-y-2 rounded-lg border bg-card p-3 text-left shadow-md">
            <p className="text-xs font-medium text-muted-foreground">Mover a carpeta</p>
            <ProjectPicker value={projectId} onChange={setProjectId} />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                Mover aquí
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
