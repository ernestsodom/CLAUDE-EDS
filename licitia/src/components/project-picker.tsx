"use client";

import { useEffect, useState } from "react";
import { FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Project {
  id: string;
  name: string;
  clients: { name: string } | null;
}

/**
 * Selector de carpeta de proyecto: elegir una existente o crear una nueva
 * con nombre del cliente (crea el cliente si no existe).
 */
export function ProjectPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, name, clients(name)")
      .eq("status", "activo")
      .order("name");
    setProjects((data ?? []) as never);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function createProject() {
    if (!newName.trim()) return;
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

    // Cliente: reutilizar si existe, crear si no
    let clientId: string | null = null;
    if (newClient.trim()) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", newClient.trim())
        .limit(1)
        .maybeSingle();
      if (existing) clientId = existing.id;
      else {
        const { data: created, error: clientError } = await supabase
          .from("clients")
          .insert({ organization_id: profile.organization_id, name: newClient.trim() })
          .select("id")
          .single();
        if (clientError) {
          setError(`Error creando cliente: ${clientError.message}`);
          setBusy(false);
          return;
        }
        clientId = created!.id;
      }
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        organization_id: profile.organization_id,
        client_id: clientId,
        name: newName.trim(),
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (projectError) {
      setError(
        projectError.message.includes("duplicate")
          ? "Ya existe una carpeta con ese nombre."
          : `Error creando carpeta: ${projectError.message}`
      );
      setBusy(false);
      return;
    }

    await loadProjects();
    onChange(project!.id);
    setCreating(false);
    setNewName("");
    setNewClient("");
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 min-w-64 rounded-md border border-input bg-background px-2 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Carpeta de proyecto"
        >
          <option value="">Sin carpeta (archivar después)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.clients?.name ? `${p.clients.name} / ` : ""}{p.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(!creating)}>
          <FolderPlus className="h-4 w-4" /> Nueva carpeta
        </Button>
      </div>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <Input
            className="max-w-56"
            placeholder="Nombre del cliente"
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
          />
          <Input
            className="max-w-64"
            placeholder="Nombre del proyecto / carpeta"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="button" size="sm" onClick={createProject} disabled={busy || !newName.trim()}>
            Crear
          </Button>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
