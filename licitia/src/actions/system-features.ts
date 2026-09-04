"use server";

import { requireUser } from "@/lib/supabase/server";
import { getChecklist, getProjectChecklist, type SystemRow } from "@/core/repositories/checklist.repo";
import { AppError } from "@/lib/errors";

type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

export interface SystemFeatureCount {
  id: string;
  name: string;
  featureCount: number;
  /** Solo en el conteo a nivel de licitación: a qué documento pedirle el
   *  análisis (cada sistema puede venir de un documento distinto). */
  documentId?: string;
}

/**
 * Cuántas funcionalidades tiene guardadas cada sistema del documento —
 * para que el comparador sepa, sin bajar el detalle completo, a cuáles
 * pedirles funcionalidades antes de comparar.
 */
export async function getSystemFeatureCounts(documentId: string): Promise<ActionResult<SystemFeatureCount[]>> {
  try {
    const { supabase } = await requireUser();
    const rows = await getChecklist(supabase, documentId);
    return {
      data: rows.map((s) => ({ id: s.id, name: s.name, featureCount: s.features.length })),
      error: null,
    };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Sistemas con sus funcionalidades completas — para mostrar el checklist
 *  marcable directamente en el comparador, sin ir a la ficha. */
export async function getFullChecklist(documentId: string): Promise<ActionResult<SystemRow[]>> {
  try {
    const { supabase } = await requireUser();
    const rows = await getChecklist(supabase, documentId);
    return { data: rows, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Igual que getSystemFeatureCounts, pero para el comparador a nivel de
 *  licitación: los sistemas de TODOS los documentos de la carpeta. */
export async function getProjectSystemFeatureCounts(
  projectId: string
): Promise<ActionResult<SystemFeatureCount[]>> {
  try {
    const { supabase } = await requireUser();
    const rows = await getProjectChecklist(supabase, projectId);
    return {
      data: rows.map((s) => ({
        id: s.id,
        name: s.name,
        featureCount: s.features.length,
        documentId: s.document_id,
      })),
      error: null,
    };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Igual que getFullChecklist, pero uniendo los sistemas de TODOS los
 *  documentos de la carpeta — para el comparador a nivel de licitación. */
export async function getFullProjectChecklist(projectId: string): Promise<ActionResult<SystemRow[]>> {
  try {
    const { supabase } = await requireUser();
    const rows = await getProjectChecklist(supabase, projectId);
    return { data: rows, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Antes: escritura directa desde `systems-checklist.tsx`. */
export async function toggleSystemFeature(
  featureId: string,
  completed: boolean
): Promise<ActionResult<{ completedAt: string | null }>> {
  try {
    const { supabase, user } = await requireUser();
    const completedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("system_features")
      .update({
        is_completed: completed,
        completed_at: completedAt,
        completed_by: completed ? user.id : null,
      })
      .eq("id", featureId);
    if (error) return { data: null, error: error.message };
    return { data: { completedAt }, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

/** Saca una funcionalidad del checklist — mal extraída, duplicada, o que
 *  simplemente no corresponde. No toca el sistema ni el resto del checklist;
 *  si el comparador ya la había comparado contra el Excel, esa comparación
 *  ya guardada no se recalcula sola (hay que volver a comparar). */
export async function deleteSystemFeature(featureId: string): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("system_features").delete().eq("id", featureId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}

export async function setSystemFeatureDeadline(
  featureId: string,
  deadlineDate: string | null
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("system_features")
      .update({ deadline_date: deadlineDate })
      .eq("id", featureId);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err) {
    if (err instanceof AppError) return { data: null, error: err.message };
    throw err;
  }
}
