"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderInput, Loader2 } from "lucide-react";
import { moveComparisonToFolder } from "@/actions/comparisons";
import { Button } from "@/components/ui/button";
import { ComparisonFolderPicker } from "@/components/comparison-folder-picker";

/**
 * Archiva una comparación en una carpeta general y, dentro de ella, en una
 * subcarpeta propia de comparaciones — separada de dónde estén archivados
 * los documentos que se compararon.
 */
export function MoveComparisonButton({
  comparisonId,
  currentProjectId,
  currentFolderId,
}: {
  comparisonId: string;
  currentProjectId: string | null;
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(currentProjectId);
  const [folderId, setFolderId] = useState<string | null>(currentFolderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const { error: dbError } = await moveComparisonToFolder(comparisonId, projectId, folderId);
    setBusy(false);
    if (dbError) {
      setError("No se pudo mover la comparación");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setProjectId(currentProjectId);
          setFolderId(currentFolderId);
          setError(null);
          setOpen(!open);
        }}
        title="Archivar en carpeta"
      >
        <FolderInput className="h-4 w-4" /> Mover a carpeta
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-96 space-y-3 rounded-lg border bg-card p-3 text-left shadow-md">
            <p className="text-xs text-muted-foreground">
              La comparación se archiva aparte de los documentos que compara — moverla no afecta
              dónde están archivados esos documentos.
            </p>
            <ComparisonFolderPicker
              projectId={projectId}
              folderId={folderId}
              onProjectChange={setProjectId}
              onFolderChange={setFolderId}
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                Guardar
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
