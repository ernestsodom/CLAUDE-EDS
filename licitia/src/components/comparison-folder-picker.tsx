"use client";

import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectPicker } from "@/components/project-picker";

interface Folder {
  id: string;
  name: string;
}

/**
 * Elige dónde archivar una comparación: primero la carpeta general
 * (proyecto/cliente, igual que los documentos) y, dentro de ella, una
 * subcarpeta propia de comparaciones — nunca la misma lista que la de los
 * documentos, aunque vivan bajo la misma carpeta general.
 */
export function ComparisonFolderPicker({
  projectId,
  folderId,
  onProjectChange,
  onFolderChange,
}: {
  projectId: string | null;
  folderId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onFolderChange: (folderId: string | null) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setFolders([]);
      return;
    }
    let cancelled = false;
    createClient()
      .from("comparison_folders")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setFolders((data ?? []) as Folder[]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function changeProject(next: string | null) {
    onProjectChange(next);
    onFolderChange(null); // las subcarpetas son propias de cada carpeta general
  }

  async function createFolder() {
    if (!projectId || !newName.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user!.id)
      .single();
    if (!profile) {
      setError("Perfil no encontrado");
      setBusy(false);
      return;
    }

    const { data: folder, error: folderError } = await supabase
      .from("comparison_folders")
      .insert({
        organization_id: profile.organization_id,
        project_id: projectId,
        name: newName.trim(),
        created_by: user!.id,
      })
      .select("id, name")
      .single();
    if (folderError) {
      setError(
        folderError.message.includes("duplicate")
          ? "Ya existe una subcarpeta con ese nombre en esta carpeta."
          : `Error creando subcarpeta: ${folderError.message}`
      );
      setBusy(false);
      return;
    }

    setFolders((prev) => [...prev, folder!].sort((a, b) => a.name.localeCompare(b.name)));
    onFolderChange(folder!.id);
    setCreating(false);
    setNewName("");
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Carpeta general</p>
        <ProjectPicker value={projectId} onChange={changeProject} />
      </div>

      {projectId && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Subcarpeta de comparaciones</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 min-w-64 rounded-md border border-input bg-background px-2 text-sm"
              value={folderId ?? ""}
              onChange={(e) => onFolderChange(e.target.value || null)}
              aria-label="Subcarpeta de comparaciones"
            >
              <option value="">Sin subcarpeta</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setCreating(!creating)}>
              <FolderPlus className="h-4 w-4" /> Nueva subcarpeta
            </Button>
          </div>

          {creating && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <Input
                className="max-w-64"
                placeholder="Nombre de la subcarpeta"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button type="button" size="sm" onClick={createFolder} disabled={busy || !newName.trim()}>
                Crear
              </Button>
              {error && <p className="w-full text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
