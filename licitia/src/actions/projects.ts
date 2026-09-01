"use server";

import { requireUser } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export interface ProjectRow {
  id: string;
  name: string;
  clients: { name: string } | null;
}

/** Antes: consulta directa desde `project-picker.tsx`. */
export async function listActiveProjects(): Promise<ProjectRow[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("projects")
    .select("id, name, clients(name)")
    .eq("status", "activo")
    .order("name");
  return (data ?? []) as unknown as ProjectRow[];
}

/**
 * Antes: lógica completa (perfil → cliente → proyecto) desde
 * `project-picker.tsx`. Reutiliza el cliente si ya existe, lo crea si no.
 */
export async function createProjectFolder(input: {
  name: string;
  clientName: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user, profile } = await requireUser();

    let clientId: string | null = null;
    if (input.clientName.trim()) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", input.clientName.trim())
        .limit(1)
        .maybeSingle();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: created, error: clientError } = await supabase
          .from("clients")
          .insert({ organization_id: profile.organization_id, name: input.clientName.trim() })
          .select("id")
          .single();
        if (clientError) return { data: null, error: `Error creando cliente: ${clientError.message}` };
        clientId = created!.id;
      }
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        organization_id: profile.organization_id,
        client_id: clientId,
        name: input.name.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (projectError) {
      return {
        data: null,
        error: projectError.message.includes("duplicate")
          ? "Ya existe una carpeta con ese nombre."
          : `Error creando carpeta: ${projectError.message}`,
      };
    }

    return { data: { id: project!.id }, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
