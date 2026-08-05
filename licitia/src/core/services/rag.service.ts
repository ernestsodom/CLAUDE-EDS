import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/openai";
import type { RetrievedChunk, SearchFilters } from "@/core/domain/types";

/**
 * Recuperación híbrida (RRF: vectorial + léxica) vía RPC `hybrid_search`.
 * El RPC corre como security definer pero valida can_read_document() por
 * chunk, de modo que el usuario solo recupera documentos autorizados.
 */
export async function retrieve(
  supabase: SupabaseClient,
  query: string,
  filters: SearchFilters = {},
  matchCount = 12
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    filter_document_ids: filters.documentIds ?? null,
    filter_doc_type: filters.docType ?? null,
    filter_client_id: filters.clientId ?? null,
  });
  if (error) throw new Error(`Error en búsqueda híbrida: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

/** Títulos de documentos para etiquetar el contexto RAG. */
export async function fetchDocTitles(
  supabase: SupabaseClient,
  documentIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(documentIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("documents").select("id, title").in("id", unique);
  return new Map((data ?? []).map((d: { id: string; title: string }) => [d.id, d.title]));
}
