import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow, DocumentType } from "@/core/domain/types";
import { NotFoundError } from "@/lib/errors";

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
  if (error || !data) throw new NotFoundError("Documento no encontrado");
  return data as DocumentRow;
}

export async function getDocumentDetail(supabase: SupabaseClient, id: string) {
  const document = await getDocument(supabase, id);
  const [summary, variables, requirements, timeline, versions, notes, delivered] =
    await Promise.all([
      supabase.from("document_summaries").select("*").eq("document_id", id).maybeSingle(),
      supabase.from("technical_variables").select("*").eq("document_id", id).order("category"),
      supabase.from("requirements").select("*").eq("document_id", id).order("created_at"),
      supabase.from("timelines").select("*, milestones(*)").eq("document_id", id).maybeSingle(),
      supabase.from("document_versions").select("*").eq("document_id", id).order("version", { ascending: false }),
      supabase.from("notes").select("*").eq("document_id", id).order("created_at", { ascending: false }),
      supabase.from("delivered_items").select("*").eq("document_id", id).order("delivered_on", { ascending: false }),
    ]);
  return {
    document,
    summary: summary.data,
    variables: variables.data ?? [],
    requirements: requirements.data ?? [],
    timeline: timeline.data,
    versions: versions.data ?? [],
    notes: notes.data ?? [],
    deliveredItems: delivered.data ?? [],
  };
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
  changeNote: string | null
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
    })
    .select("id, version")
    .single();
  if (error || !version) throw new Error(`Error creando versión: ${error?.message}`);
  return version;
}
