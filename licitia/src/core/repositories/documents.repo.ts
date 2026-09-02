import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow, DocumentType } from "@/core/domain/types";
import { NotFoundError } from "@/lib/errors";
import { getChecklist } from "./checklist.repo";

// ============================================================================
// Repository de documentos: encapsula el acceso a datos; los servicios y
// route handlers no escriben queries de Supabase directamente.
// Todas las operaciones corren con el cliente del usuario ⇒ RLS aplica.
// ============================================================================

export interface DocumentFilters {
  search?: string;
  docType?: DocumentType;
  clientId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listDocuments(supabase: SupabaseClient, filters: DocumentFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  let query = supabase
    .from("documents")
    .select("*, clients(name)", { count: "exact" })
    .is("parent_document_id", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.docType) query = query.eq("doc_type", filters.docType);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { documents: (data ?? []) as (DocumentRow & { clients: { name: string } | null })[], total: count ?? 0 };
}

export async function getDocument(supabase: SupabaseClient, id: string): Promise<DocumentRow> {
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
  if (error || !data) {
    // Log temporal: diagnosticando un "Documento no encontrado" en Neon con
    // datos que sí existen y pasan RLS al comprobarlos a mano. Quitar una vez
    // resuelto.
    console.error("get_document_not_found", { id, error });
    throw new NotFoundError("Documento no encontrado");
  }
  return data as DocumentRow;
}

export async function getDocumentDetail(supabase: SupabaseClient, id: string) {
  const document = await getDocument(supabase, id);
  const [requirements, timeline, versions, delivered, systems] = await Promise.all([
    supabase.from("requirements").select("*").eq("document_id", id).order("created_at"),
    supabase.from("timelines").select("*, milestones(*)").eq("document_id", id).maybeSingle(),
    supabase.from("document_versions").select("*").eq("document_id", id).order("version", { ascending: false }),
    supabase.from("delivered_items").select("*").eq("document_id", id).order("delivered_on", { ascending: false }),
    getChecklist(supabase, id),
  ]);

  // document_summaries no tiene un único registro por documento — tiene uno
  // POR VERSIÓN (unique(version_id)), porque cada reanálisis con otro motor
  // genera su propio resumen sin pisar el anterior. Filtrar solo por
  // document_id, como hacía antes, trae más de una fila apenas el documento
  // tiene 2+ versiones: .maybeSingle() falla silenciosamente (el error se
  // descarta) y el resumen se ve como "no generado" aunque sí exista. Se
  // busca explícitamente el de la versión actual, igual que getVersionSummary.
  const currentVersion = (versions.data ?? []).find((v) => v.is_current);
  const summary = currentVersion ? await getVersionSummary(supabase, currentVersion.id) : null;

  return {
    document,
    summary,
    requirements: requirements.data ?? [],
    timeline: timeline.data,
    versions: versions.data ?? [],
    deliveredItems: delivered.data ?? [],
    systems,
  };
}

/**
 * Resumen ejecutivo de una versión concreta (no necesariamente la actual):
 * cada reanálisis con otro motor genera su propio resumen sin pisar el
 * anterior, así que se puede ver — y en el futuro comparar — lo que produjo
 * cada motor.
 */
export async function getVersionSummary(supabase: SupabaseClient, versionId: string) {
  const { data } = await supabase
    .from("document_summaries")
    .select("*")
    .eq("version_id", versionId)
    .maybeSingle();
  return data;
}

/** Crea documento + versión 1 + registro de archivo. Devuelve IDs para el pipeline. */
export async function createDocumentWithFile(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    title: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    projectId?: string | null;
  }
) {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      status: "subido",
      created_by: input.userId,
      project_id: input.projectId ?? null,
    })
    .select("id")
    .single();
  if (docError || !document) throw new Error(`Error creando documento: ${docError?.message}`);

  const { data: version, error: verError } = await supabase
    .from("document_versions")
    .insert({ document_id: document.id, version: 1, created_by: input.userId })
    .select("id")
    .single();
  if (verError || !version) throw new Error(`Error creando versión: ${verError?.message}`);

  const { error: fileError } = await supabase.from("files").insert({
    version_id: version.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    checksum_sha256: input.checksum,
  });
  if (fileError) throw new Error(`Error registrando archivo: ${fileError.message}`);

  return { documentId: document.id as string, versionId: version.id as string };
}

/** Nueva versión de un documento existente. */
export async function createNewVersion(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  changeNote: string | null,
  engine?: string | null
) {
  const { data: latest } = await supabase
    .from("document_versions")
    .select("version")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latest?.version ?? 0) + 1;
  await supabase
    .from("document_versions")
    .update({ is_current: false })
    .eq("document_id", documentId);

  const { data: version, error } = await supabase
    .from("document_versions")
    .insert({
      document_id: documentId,
      version: nextVersion,
      change_note: changeNote,
      created_by: userId,
      is_current: true,
      analysis_engine: engine ?? null,
    })
    .select("id, version")
    .single();
  if (error || !version) throw new Error(`Error creando versión: ${error?.message}`);
  return version;
}

/**
 * Copia el archivo de la versión actual a una versión nueva: reanalizar con
 * otro motor no implica volver a subir el mismo PDF, solo volver a leerlo.
 */
export async function copyCurrentFileToVersion(
  supabase: SupabaseClient,
  documentId: string,
  newVersionId: string
) {
  const { data: currentVersion } = await supabase
    .from("document_versions")
    .select("id")
    .eq("document_id", documentId)
    .neq("id", newVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (!currentVersion) throw new Error("No se encontró la versión anterior del documento");

  const { data: file } = await supabase
    .from("files")
    .select("storage_path, file_name, mime_type, size_bytes, checksum_sha256")
    .eq("version_id", currentVersion.id)
    .limit(1)
    .single();
  if (!file) throw new Error("No se encontró el archivo de la versión anterior");

  const { error } = await supabase.from("files").insert({ ...file, version_id: newVersionId });
  if (error) throw new Error(`Error copiando el archivo a la nueva versión: ${error.message}`);
}
