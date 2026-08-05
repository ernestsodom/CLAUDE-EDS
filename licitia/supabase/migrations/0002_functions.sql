-- ============================================================================
-- LicitIA — Funciones de búsqueda (vectorial, léxica e híbrida RRF)
-- ============================================================================

-- Helpers de autorización usados también por RLS (0003)
create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function current_role_of() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function can_read_document(doc_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from documents d
    where d.id = doc_id
      and d.organization_id = current_org_id()
      and (
        current_role_of() in ('admin', 'supervisor')
        or d.created_by = auth.uid()
        or exists (select 1 from document_permissions p
                   where p.document_id = d.id and p.user_id = auth.uid())
      )
  );
$$;

-- ─── Búsqueda vectorial con filtros ─────────────────────────────────────────
-- filter_document_ids: null = toda la biblioteca autorizada.
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 12,
  filter_document_ids uuid[] default null,
  filter_doc_type document_type default null,
  filter_client_id uuid default null
)
returns table (
  chunk_id uuid, document_id uuid, content text,
  page_start int, page_end int, section text, similarity float
)
language sql stable security definer set search_path = public as $$
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section,
         1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
    and can_read_document(d.id)
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
    and (filter_doc_type is null or d.doc_type = filter_doc_type)
    and (filter_client_id is null or d.client_id = filter_client_id)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ─── Búsqueda léxica (full text español) ────────────────────────────────────
create or replace function search_chunks_text(
  query_text text,
  match_count int default 12,
  filter_document_ids uuid[] default null,
  filter_doc_type document_type default null,
  filter_client_id uuid default null
)
returns table (
  chunk_id uuid, document_id uuid, content text,
  page_start int, page_end int, section text, rank float
)
language sql stable security definer set search_path = public as $$
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section,
         ts_rank(c.tsv, websearch_to_tsquery('spanish', query_text)) as rank
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.tsv @@ websearch_to_tsquery('spanish', query_text)
    and can_read_document(d.id)
    and (filter_document_ids is null or c.document_id = any(filter_document_ids))
    and (filter_doc_type is null or d.doc_type = filter_doc_type)
    and (filter_client_id is null or d.client_id = filter_client_id)
  order by rank desc
  limit match_count;
$$;

-- ─── Búsqueda híbrida: Reciprocal Rank Fusion ───────────────────────────────
-- score = Σ 1/(k + rank_i) con k = 60 (valor clásico de RRF).
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int default 12,
  filter_document_ids uuid[] default null,
  filter_doc_type document_type default null,
  filter_client_id uuid default null
)
returns table (
  chunk_id uuid, document_id uuid, content text,
  page_start int, page_end int, section text, score float
)
language sql stable security definer set search_path = public as $$
  with vec as (
    select chunk_id, row_number() over () as r
    from match_chunks(query_embedding, match_count * 2,
                      filter_document_ids, filter_doc_type, filter_client_id)
  ),
  lex as (
    select chunk_id, row_number() over () as r
    from search_chunks_text(query_text, match_count * 2,
                            filter_document_ids, filter_doc_type, filter_client_id)
  ),
  fused as (
    select coalesce(v.chunk_id, l.chunk_id) as chunk_id,
           coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + l.r), 0) as score
    from vec v full outer join lex l using (chunk_id)
  )
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section, f.score
  from fused f
  join document_chunks c on c.id = f.chunk_id
  order by f.score desc
  limit match_count;
$$;

-- ─── KPIs del dashboard ─────────────────────────────────────────────────────
create or replace function dashboard_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_documents',  (select count(*) from documents d where can_read_document(d.id)),
    'total_clients',    (select count(*) from clients where organization_id = current_org_id()),
    'total_tenders',    (select count(*) from documents d where can_read_document(d.id) and d.doc_type = 'licitacion'),
    'pending_documents',(select count(*) from documents d where can_read_document(d.id) and d.status in ('subido','procesando')),
    'error_documents',  (select count(*) from documents d where can_read_document(d.id) and d.status = 'error'),
    'total_amount',     (select coalesce(sum(amount), 0) from documents d where can_read_document(d.id)),
    'total_requirements',(select count(*) from requirements r where can_read_document(r.document_id)),
    'by_type',          (select coalesce(jsonb_object_agg(doc_type, n), '{}'::jsonb) from
                          (select doc_type, count(*) n from documents d
                           where can_read_document(d.id) group by doc_type) s),
    'by_status',        (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                          (select status, count(*) n from documents d
                           where can_read_document(d.id) group by status) s)
  );
$$;
