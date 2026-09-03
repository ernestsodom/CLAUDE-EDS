import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistSystem } from "@/core/services/checklist.service";

// ============================================================================
// Lectura del checklist de un documento: sistemas con sus funcionalidades,
// en el orden en que aparecen en el documento. Corre con la sesión del
// usuario ⇒ RLS aplica.
// ============================================================================

export interface FeatureRow {
  id: string;
  name: string;
  description: string | null;
  deadline_text: string | null;
  deadline_date: string | null;
  page: number | null;
  quote: string | null;
  is_mandatory: boolean;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  evidence_type: "explicito" | "implicito" | "interpretacion" | null;
}

export interface SystemRow {
  id: string;
  name: string;
  description: string | null;
  deadline_text: string | null;
  page: number | null;
  quote: string | null;
  sort_order: number;
  features: FeatureRow[];
}

export async function getChecklist(
  supabase: SupabaseClient,
  documentId: string
): Promise<SystemRow[]> {
  const { data: systems } = await supabase
    .from("systems")
    .select("id, name, description, deadline_text, page, quote, sort_order")
    .eq("document_id", documentId)
    .order("sort_order");
  if (!systems?.length) return [];

  const { data: features } = await supabase
    .from("system_features")
    .select(
      "id, system_id, name, description, deadline_text, deadline_date, page, quote, is_mandatory, is_completed, completed_at, sort_order, evidence_type"
    )
    .eq("document_id", documentId)
    .order("sort_order");

  const bySystem = new Map<string, FeatureRow[]>();
  for (const f of (features ?? []) as Array<FeatureRow & { system_id: string }>) {
    const list = bySystem.get(f.system_id) ?? [];
    list.push(f);
    bySystem.set(f.system_id, list);
  }

  return (systems as Omit<SystemRow, "features">[]).map((s) => ({
    ...s,
    features: bySystem.get(s.id) ?? [],
  }));
}

/** Vista del checklist tal como la consume el comparador contra Excel. */
export function toChecklistSystems(rows: SystemRow[]): ChecklistSystem[] {
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    deadlineText: s.deadline_text,
    features: s.features.map((f) => ({
      id: f.id,
      name: f.name,
      deadlineText: f.deadline_text,
      isCompleted: f.is_completed,
    })),
  }));
}

/** Resumen de avance: cuántas funcionalidades hay y cuántas están completadas. */
export function checklistProgress(rows: SystemRow[]) {
  const total = rows.reduce((n, s) => n + s.features.length, 0);
  const completed = rows.reduce(
    (n, s) => n + s.features.filter((f) => f.is_completed).length,
    0
  );
  return { total, completed, pct: total === 0 ? 0 : Math.round((completed / total) * 100) };
}
