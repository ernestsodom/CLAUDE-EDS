-- ============================================================================
-- LicitIA — INSTALACIÓN COMPLETA EN UN SOLO PASO
--
-- Cómo usarlo:
--   1. Abre tu proyecto en supabase.com → SQL Editor → New query
--   2. Copia y pega TODO este archivo
--   3. Pulsa "Run"
--
-- Incluye: esquema completo, funciones de búsqueda, seguridad (RLS),
-- almacenamiento de archivos, datos de ejemplo y creación automática del
-- perfil de administrador (el primer usuario que crees será el admin).
--
-- Equivale a las migraciones 0001–0006 + seed, consolidadas para una
-- instalación nueva. Es idempotente: puede ejecutarse más de una vez.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ─── Tipos ──────────────────────────────────────────────────────────────────

do $$ begin
  create type user_role as enum ('admin', 'supervisor', 'usuario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum (
    'licitacion', 'bases_administrativas', 'bases_tecnicas',
    'propuesta_comercial', 'propuesta_tecnica', 'carta_gantt',
    'contrato', 'anexo', 'reclamo', 'informe', 'acta', 'avance',
    'control_entregas', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum ('subido', 'procesando', 'procesado', 'error', 'archivado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type processing_step as enum (
    'extraccion_texto', 'ocr', 'chunking', 'embeddings',
    'clasificacion', 'resumen', 'variables', 'sistemas', 'requerimientos',
    'timeline', 'completado'
  );
exception when duplicate_object then null; end $$;

-- Etapas añadidas después de la primera versión: al reejecutar este archivo
-- sobre una instalación existente, el enum ya existe y el bloque de arriba no
-- se aplica, así que los valores nuevos se agregan aquí.
alter type processing_step add value if not exists 'requerimientos';
alter type processing_step add value if not exists 'sistemas';

do $$ begin
  create type requirement_status as enum (
    'cumplido', 'parcial', 'pendiente', 'no_aplica', 'fuera_de_alcance', 'adicional'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_level as enum ('bajo', 'medio', 'alto', 'critico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variable_category as enum (
    'sistema', 'modulo', 'funcionalidad', 'integracion', 'api', 'reporte',
    'dashboard', 'interfaz', 'servicio_web', 'base_datos', 'infraestructura',
    'seguridad', 'backup', 'migracion', 'capacitacion', 'implementacion',
    'mesa_ayuda', 'soporte', 'sla', 'hardware', 'software', 'licencia',
    'multa', 'garantia', 'certificacion', 'personal', 'experiencia', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type milestone_type as enum (
    'inicio', 'hito', 'capacitacion', 'implementacion', 'marcha_blanca',
    'recepcion', 'garantia', 'soporte', 'termino', 'entregable', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type comparison_type as enum (
    'cumplimiento', 'licitacion_vs_licitacion', 'propuesta_vs_propuesta',
    'contrato_vs_contrato', 'version_vs_version'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('nuevo', 'analizado', 'respondido', 'cerrado');
exception when duplicate_object then null; end $$;

-- ─── Organizaciones, usuarios, clientes y carpetas ──────────────────────────

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  role            user_role not null default 'usuario',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_profiles_org on profiles(organization_id);

create table if not exists clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  kind            text,
  country         text default 'Chile',
  region          text,
  city            text,
  contact_email   text,
  contact_phone   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists idx_clients_org on clients(organization_id);
create index if not exists idx_clients_name_trgm on clients using gin (name gin_trgm_ops);

-- Carpeta de proyecto: agrupa todo lo relacionado a un proyecto de un cliente
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  name            text not null,
  description     text,
  status          text not null default 'activo',
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists idx_projects_org on projects(organization_id);
create index if not exists idx_projects_client on projects(client_id);

-- ─── Documentos ─────────────────────────────────────────────────────────────

create table if not exists documents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  client_id          uuid references clients(id) on delete set null,
  project_id         uuid references projects(id) on delete set null,
  parent_document_id uuid references documents(id) on delete set null,
  title              text not null,
  doc_type           document_type not null default 'otro',
  status             document_status not null default 'subido',
  processing_step    processing_step,
  processing_error   text,
  tender_number      text,
  tender_name        text,
  market_id          text,
  provider           text,
  area               text,
  project_type       text,
  country            text,
  region             text,
  city               text,
  doc_date           date,
  amount             numeric(18,2),
  currency           text default 'CLP',
  contract_duration  text,
  language           text default 'es',
  doc_state          text,
  page_count         int,
  is_scanned         boolean not null default false,
  classification     jsonb,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_documents_org on documents(organization_id);
create index if not exists idx_documents_client on documents(client_id);
create index if not exists idx_documents_project on documents(project_id);
create index if not exists idx_documents_type on documents(doc_type);
create index if not exists idx_documents_status on documents(status);
create index if not exists idx_documents_date on documents(doc_date);
create index if not exists idx_documents_tender on documents(tender_number);
create index if not exists idx_documents_title_trgm on documents using gin (title gin_trgm_ops);

create table if not exists document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  version      int not null,
  change_note  text,
  is_current   boolean not null default true,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (document_id, version)
);
create index if not exists idx_versions_doc on document_versions(document_id);

create table if not exists files (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references document_versions(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  checksum_sha256 text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_files_version on files(version_id);

create table if not exists document_pages (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references document_versions(id) on delete cascade,
  page_number  int not null,
  content      text not null,
  ocr_used     boolean not null default false,
  unique (version_id, page_number)
);
create index if not exists idx_pages_version on document_pages(version_id);

create table if not exists document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  version_id   uuid not null references document_versions(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  page_start   int,
  page_end     int,
  section      text,
  token_count  int,
  embedding    vector(1536),
  tsv          tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at   timestamptz not null default now(),
  unique (version_id, chunk_index)
);
create index if not exists idx_chunks_doc on document_chunks(document_id);
create index if not exists idx_chunks_tsv on document_chunks using gin (tsv);
create index if not exists idx_chunks_embedding on document_chunks
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create table if not exists document_metadata (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  key          text not null,
  value        text,
  value_json   jsonb,
  source       text not null default 'ia',
  unique (document_id, key)
);
create index if not exists idx_metadata_doc on document_metadata(document_id);
create index if not exists idx_metadata_key on document_metadata(key);

-- ─── Análisis IA ────────────────────────────────────────────────────────────

create table if not exists document_summaries (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  version_id      uuid not null references document_versions(id) on delete cascade,
  summary         text,
  objective       text,
  scope           text,
  problems        jsonb,
  requirements    jsonb,
  obligations     jsonb,
  restrictions    jsonb,
  risks           jsonb,
  critical_points jsonb,
  deliverables    jsonb,
  schedule        jsonb,
  recommendations jsonb,
  model           text,
  created_at      timestamptz not null default now(),
  unique (version_id)
);

create table if not exists technical_variables (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  category     variable_category not null,
  name         text not null,
  description  text,
  value        text,
  page         int,
  quote        text,
  confidence   real,
  created_at   timestamptz not null default now()
);
create index if not exists idx_tech_vars_doc on technical_variables(document_id);
create index if not exists idx_tech_vars_cat on technical_variables(category);
create index if not exists idx_tech_vars_name_trgm on technical_variables using gin (name gin_trgm_ops);

create table if not exists requirements (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  code         text,
  title        text not null,
  description  text,
  category     text,
  mandatory    boolean default true,
  page         int,
  quote        text,
  priority     risk_level default 'medio',
  created_at   timestamptz not null default now()
);
create index if not exists idx_requirements_doc on requirements(document_id);

-- Control interno de entregas: lo realmente entregado, incluidos los
-- trabajos adicionales fuera de acuerdo y los realizados sin costo.
create table if not exists delivered_items (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  title           text not null,
  description     text,
  delivered_on    date,
  delivery_state  text not null default 'entregado',
  is_additional   boolean not null default false,
  is_free         boolean not null default false,
  requirement_ref text,
  page            int,
  quote           text,
  confidence      real,
  created_at      timestamptz not null default now()
);
create index if not exists idx_delivered_items_doc on delivered_items(document_id);
create index if not exists idx_delivered_items_additional on delivered_items(is_additional) where is_additional;

-- ─── Cronogramas ────────────────────────────────────────────────────────────

create table if not exists timelines (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  title        text not null default 'Cronograma del proyecto',
  generated_by text not null default 'ia',
  created_at   timestamptz not null default now(),
  unique (document_id)
);

create table if not exists milestones (
  id             uuid primary key default gen_random_uuid(),
  timeline_id    uuid not null references timelines(id) on delete cascade,
  milestone_type milestone_type not null default 'hito',
  title          text not null,
  description    text,
  starts_on      date,
  ends_on        date,
  duration_label text,
  page           int,
  quote          text,
  sort_order     int not null default 0
);
create index if not exists idx_milestones_timeline on milestones(timeline_id);

-- ─── Conversaciones IA ──────────────────────────────────────────────────────

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  document_id     uuid references documents(id) on delete cascade,
  agent           text not null default 'analista',
  title           text not null default 'Nueva conversación',
  is_favorite     boolean not null default false,
  duplicated_from uuid references conversations(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_conversations_user on conversations(user_id);
create index if not exists idx_conversations_doc on conversations(document_id);

create table if not exists conversation_tags (
  conversation_id uuid not null references conversations(id) on delete cascade,
  tag             text not null,
  primary key (conversation_id, tag)
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  citations       jsonb,
  confidence      real,
  model           text,
  token_usage     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_conversation on messages(conversation_id);

-- ─── Comparaciones ──────────────────────────────────────────────────────────

create table if not exists comparisons (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  comparison_type    comparison_type not null,
  source_document_id uuid not null references documents(id) on delete cascade,
  target_document_id uuid not null references documents(id) on delete cascade,
  status             text not null default 'procesando',
  pct_fulfilled      real,
  pct_partial        real,
  pct_pending        real,
  pct_additional     real,
  pct_out_of_scope   real,
  traffic_light      text,
  summary            text,
  differences        jsonb,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_comparisons_org on comparisons(organization_id);
create index if not exists idx_comparisons_source on comparisons(source_document_id);

create table if not exists comparison_items (
  id                   uuid primary key default gen_random_uuid(),
  comparison_id        uuid not null references comparisons(id) on delete cascade,
  requirement_id       uuid references requirements(id) on delete set null,
  requirement_text     text not null,
  status               requirement_status not null,
  evidence_quote       text,
  evidence_document_id uuid references documents(id) on delete set null,
  evidence_page        int,
  ai_comment           text,
  risk                 risk_level not null default 'medio',
  priority             risk_level not null default 'medio',
  sort_order           int not null default 0
);
create index if not exists idx_comparison_items_cmp on comparison_items(comparison_id);

-- ─── Reclamos ───────────────────────────────────────────────────────────────

create table if not exists claims (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organizations(id) on delete cascade,
  client_id            uuid references clients(id) on delete set null,
  contract_document_id uuid references documents(id) on delete set null,
  subject              text,
  raw_email            text not null,
  status               claim_status not null default 'nuevo',
  analysis             jsonb,
  created_by           uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_claims_org on claims(organization_id);

create table if not exists claim_responses (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references claims(id) on delete cascade,
  content     text not null,
  citations   jsonb,
  model       text,
  approved    boolean not null default false,
  approved_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_claim_responses_claim on claim_responses(claim_id);

-- ─── Notas, etiquetas, permisos, auditoría ──────────────────────────────────

create table if not exists tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text default '#6366f1',
  unique (organization_id, name)
);

create table if not exists document_tags (
  document_id uuid not null references documents(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null default 'comentario',
  content     text not null,
  page        int,
  due_date    date,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_notes_doc on notes(document_id);
create index if not exists idx_notes_user on notes(user_id);

create table if not exists document_permissions (
  document_id uuid not null references documents(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  can_write   boolean not null default false,
  granted_by  uuid references profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table if not exists audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references organizations(id) on delete set null,
  user_id         uuid,
  action          text not null,
  entity_type     text,
  entity_id       uuid,
  detail          jsonb,
  ip              inet,
  created_at      timestamptz not null default now()
);
create index if not exists idx_audit_org_date on audit_logs(organization_id, created_at desc);

create table if not exists app_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  chat_model      text,
  embedding_model text,
  ocr_enabled     boolean not null default true,
  max_upload_mb   int not null default 50,
  extra           jsonb not null default '{}'
);

-- ─── updated_at automático ──────────────────────────────────────────────────

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','clients','projects','documents',
    'conversations','comparisons','claims','notes']
  loop
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format(
      'create trigger trg_%s_updated before update on %I for each row execute function set_updated_at()',
      t, t);
  end loop;
end $$;

-- ─── Autorización (usada por RLS y por las búsquedas) ───────────────────────

create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function current_role_of() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- El permiso explícito se consulta con SECURITY DEFINER para evitar recursión
-- entre las políticas de documents y document_permissions.
create or replace function has_document_permission(doc_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from document_permissions p
    where p.document_id = doc_id and p.user_id = auth.uid()
  );
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

-- ─── Búsqueda vectorial, léxica e híbrida ───────────────────────────────────

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

-- Fusión por Reciprocal Rank Fusion (k = 60)
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
    select mc.chunk_id, row_number() over () as r
    from match_chunks(query_embedding, match_count * 2,
                      filter_document_ids, filter_doc_type, filter_client_id) mc
  ),
  lex as (
    select sc.chunk_id, row_number() over () as r
    from search_chunks_text(query_text, match_count * 2,
                            filter_document_ids, filter_doc_type, filter_client_id) sc
  ),
  fused as (
    select coalesce(v.chunk_id, l.chunk_id) as chunk_id,
           coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + l.r), 0) as score
    from vec v full outer join lex l on v.chunk_id = l.chunk_id
  )
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section, f.score
  from fused f
  join document_chunks c on c.id = f.chunk_id
  order by f.score desc
  limit match_count;
$$;

create or replace function dashboard_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_documents',   (select count(*) from documents d where can_read_document(d.id)),
    'total_clients',     (select count(*) from clients where organization_id = current_org_id()),
    'total_tenders',     (select count(*) from documents d where can_read_document(d.id) and d.doc_type = 'licitacion'),
    'pending_documents', (select count(*) from documents d where can_read_document(d.id) and d.status in ('subido','procesando')),
    'error_documents',   (select count(*) from documents d where can_read_document(d.id) and d.status = 'error'),
    'total_amount',      (select coalesce(sum(amount), 0) from documents d where can_read_document(d.id)),
    'total_requirements',(select count(*) from requirements r where can_read_document(r.document_id)),
    'by_type',           (select coalesce(jsonb_object_agg(doc_type, n), '{}'::jsonb) from
                           (select doc_type, count(*) n from documents d
                            where can_read_document(d.id) group by doc_type) s),
    'by_status',         (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from
                           (select status, count(*) n from documents d
                            where can_read_document(d.id) group by status) s)
  );
$$;

-- ─── Seguridad a nivel de fila (RLS) ────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','clients','projects','documents','document_versions',
    'files','document_pages','document_chunks','document_metadata','document_summaries',
    'technical_variables','requirements','delivered_items','timelines','milestones',
    'conversations','conversation_tags','messages','comparisons','comparison_items',
    'claims','claim_responses','tags','document_tags','notes','document_permissions',
    'audit_logs','app_settings']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists org_select on organizations;
create policy org_select on organizations for select using (id = current_org_id());

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (organization_id = current_org_id());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid());
drop policy if exists profiles_admin_all on profiles;
create policy profiles_admin_all on profiles for all
  using (organization_id = current_org_id() and current_role_of() = 'admin');

drop policy if exists clients_select on clients;
create policy clients_select on clients for select using (organization_id = current_org_id());
drop policy if exists clients_write on clients;
create policy clients_write on clients for all
  using (organization_id = current_org_id() and current_role_of() in ('admin', 'supervisor'));
drop policy if exists clients_insert_any on clients;
create policy clients_insert_any on clients for insert with check (organization_id = current_org_id());

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (organization_id = current_org_id());
drop policy if exists projects_insert on projects;
create policy projects_insert on projects for insert with check (organization_id = current_org_id());
drop policy if exists projects_update on projects;
create policy projects_update on projects for update
  using (organization_id = current_org_id()
         and (current_role_of() in ('admin','supervisor') or created_by = auth.uid()));
drop policy if exists projects_delete on projects;
create policy projects_delete on projects for delete
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- Nota: esta política evalúa la condición sobre las columnas de la propia
-- fila (sin auto-consultar documents). Es imprescindible para que funcione
-- `INSERT ... RETURNING`, que exige política de SELECT sobre la fila nueva:
-- una función STABLE que releyera la tabla no vería la fila en curso.
drop policy if exists documents_select on documents;
create policy documents_select on documents for select
  using (
    organization_id = current_org_id()
    and (
      current_role_of() in ('admin', 'supervisor')
      or created_by = auth.uid()
      or has_document_permission(id)
    )
  );
drop policy if exists documents_insert on documents;
create policy documents_insert on documents for insert with check (organization_id = current_org_id());
drop policy if exists documents_update on documents;
create policy documents_update on documents for update
  using (organization_id = current_org_id()
         and (current_role_of() in ('admin','supervisor')
              or created_by = auth.uid()
              or exists (select 1 from document_permissions p
                         where p.document_id = id and p.user_id = auth.uid() and p.can_write)));
drop policy if exists documents_delete on documents;
create policy documents_delete on documents for delete
  using (organization_id = current_org_id() and current_role_of() = 'admin');

drop policy if exists versions_select on document_versions;
create policy versions_select on document_versions for select using (can_read_document(document_id));
-- Escritura: la ruta de subida crea versiones con el cliente del usuario
drop policy if exists versions_insert on document_versions;
create policy versions_insert on document_versions for insert
  with check (exists (select 1 from documents d
                      where d.id = document_id and d.organization_id = current_org_id()));
drop policy if exists versions_update on document_versions;
create policy versions_update on document_versions for update
  using (exists (select 1 from documents d
                 where d.id = document_id and d.organization_id = current_org_id()));
drop policy if exists pages_select on document_pages;
create policy pages_select on document_pages for select
  using (exists (select 1 from document_versions v where v.id = version_id and can_read_document(v.document_id)));
drop policy if exists files_select on files;
create policy files_select on files for select
  using (exists (select 1 from document_versions v where v.id = version_id and can_read_document(v.document_id)));
drop policy if exists files_insert on files;
create policy files_insert on files for insert
  with check (exists (select 1 from document_versions v join documents d on d.id = v.document_id
                      where v.id = version_id and d.organization_id = current_org_id()));
drop policy if exists files_update on files;
create policy files_update on files for update
  using (exists (select 1 from document_versions v join documents d on d.id = v.document_id
                 where v.id = version_id and d.organization_id = current_org_id()));
drop policy if exists chunks_select on document_chunks;
create policy chunks_select on document_chunks for select using (can_read_document(document_id));
drop policy if exists metadata_select on document_metadata;
create policy metadata_select on document_metadata for select using (can_read_document(document_id));
drop policy if exists summaries_select on document_summaries;
create policy summaries_select on document_summaries for select using (can_read_document(document_id));
drop policy if exists techvars_select on technical_variables;
create policy techvars_select on technical_variables for select using (can_read_document(document_id));
drop policy if exists reqs_select on requirements;
create policy reqs_select on requirements for select using (can_read_document(document_id));
drop policy if exists delivered_items_select on delivered_items;
create policy delivered_items_select on delivered_items for select using (can_read_document(document_id));
drop policy if exists timelines_select on timelines;
create policy timelines_select on timelines for select using (can_read_document(document_id));
drop policy if exists milestones_select on milestones;
create policy milestones_select on milestones for select
  using (exists (select 1 from timelines t where t.id = timeline_id and can_read_document(t.document_id)));

drop policy if exists conversations_owner on conversations;
create policy conversations_owner on conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists conv_tags_owner on conversation_tags;
create policy conv_tags_owner on conversation_tags for all
  using (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists messages_owner on messages;
create policy messages_owner on messages for all
  using (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists comparisons_select on comparisons;
create policy comparisons_select on comparisons for select
  using (organization_id = current_org_id() and can_read_document(source_document_id));
drop policy if exists comparisons_insert on comparisons;
create policy comparisons_insert on comparisons for insert with check (organization_id = current_org_id());
drop policy if exists comparison_items_select on comparison_items;
create policy comparison_items_select on comparison_items for select
  using (exists (select 1 from comparisons c
                 where c.id = comparison_id and c.organization_id = current_org_id()
                   and can_read_document(c.source_document_id)));

drop policy if exists claims_all on claims;
create policy claims_all on claims for all
  using (organization_id = current_org_id()) with check (organization_id = current_org_id());
drop policy if exists claim_responses_all on claim_responses;
create policy claim_responses_all on claim_responses for all
  using (exists (select 1 from claims c where c.id = claim_id and c.organization_id = current_org_id()));

drop policy if exists tags_select on tags;
create policy tags_select on tags for select using (organization_id = current_org_id());
drop policy if exists tags_write on tags;
create policy tags_write on tags for all using (organization_id = current_org_id());
drop policy if exists doc_tags_all on document_tags;
create policy doc_tags_all on document_tags for all using (can_read_document(document_id));

drop policy if exists notes_select on notes;
create policy notes_select on notes for select using (can_read_document(document_id));
drop policy if exists notes_write on notes;
create policy notes_write on notes for insert with check (user_id = auth.uid() and can_read_document(document_id));
drop policy if exists notes_update on notes;
create policy notes_update on notes for update using (user_id = auth.uid());
drop policy if exists notes_delete on notes;
create policy notes_delete on notes for delete using (user_id = auth.uid());

drop policy if exists perms_select on document_permissions;
create policy perms_select on document_permissions for select
  using (user_id = auth.uid()
         or (current_role_of() in ('admin','supervisor')
             and exists (select 1 from documents d
                         where d.id = document_id and d.organization_id = current_org_id())));
drop policy if exists perms_write on document_permissions;
create policy perms_write on document_permissions for all
  using (current_role_of() in ('admin','supervisor')
         and exists (select 1 from documents d
                     where d.id = document_id and d.organization_id = current_org_id()));

drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select
  using (organization_id = current_org_id() and current_role_of() = 'admin');
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert with check (organization_id = current_org_id());

drop policy if exists settings_select on app_settings;
create policy settings_select on app_settings for select using (organization_id = current_org_id());
drop policy if exists settings_write on app_settings;
create policy settings_write on app_settings for all
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- ─── Almacenamiento de archivos ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists storage_docs_read on storage.objects;
create policy storage_docs_read on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists storage_docs_insert on storage.objects;
create policy storage_docs_insert on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists storage_docs_update on storage.objects;
create policy storage_docs_update on storage.objects for update
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists storage_docs_delete on storage.objects;
create policy storage_docs_delete on storage.objects for delete
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = current_org_id()::text
         and current_role_of() = 'admin');

drop policy if exists storage_exports_rw on storage.objects;
create policy storage_exports_rw on storage.objects for all
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = current_org_id()::text);

-- ─── Datos iniciales ────────────────────────────────────────────────────────

insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Mi Organización', 'principal')
on conflict (id) do nothing;

insert into app_settings (organization_id) values
  ('11111111-1111-1111-1111-111111111111')
on conflict do nothing;

insert into clients (id, organization_id, name, kind, country, region, city) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Municipalidad de Puerto Montt', 'municipio', 'Chile', 'Los Lagos', 'Puerto Montt'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Municipalidad de Valdivia', 'municipio', 'Chile', 'Los Ríos', 'Valdivia'),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Servicio de Salud Reloncaví', 'institucion', 'Chile', 'Los Lagos', 'Puerto Montt')
on conflict (id) do nothing;

insert into projects (id, organization_id, client_id, name, description) values
  ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '22222222-0000-0000-0000-000000000001', 'SGM Puerto Montt 2026',
   'Ejemplo: implementación del Sistema de Gestión Municipal — licitación 2397-45-LR26')
on conflict (id) do nothing;

insert into documents (id, organization_id, client_id, project_id, title, doc_type, status,
  tender_number, tender_name, market_id, doc_date, amount, currency,
  contract_duration, country, region, city, language)
values (
  '33333333-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '22222222-0000-0000-0000-000000000001',
  '66666666-0000-0000-0000-000000000001',
  'EJEMPLO — Licitación Sistema de Gestión Municipal Puerto Montt',
  'licitacion', 'procesado',
  '2397-45-LR26', 'Adquisición e implementación de Sistema de Gestión Municipal',
  '2397-45-LR26', '2026-03-15', 185000000, 'CLP',
  '24 meses', 'Chile', 'Los Lagos', 'Puerto Montt', 'es'
)
on conflict (id) do nothing;

insert into document_versions (id, document_id, version, is_current) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 1, true)
on conflict (id) do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from requirements where document_id = '33333333-0000-0000-0000-000000000001') then
  insert into requirements (document_id, code, title, description, category, mandatory, page, priority) values
    ('33333333-0000-0000-0000-000000000001', 'RQ-001', 'Módulo de Rentas y Patentes',
     'Gestión completa de rentas municipales y patentes comerciales.', 'modulo', true, 12, 'alto'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-002', 'Integración con Tesorería General',
     'Integración en línea con Tesorería General de la República para conciliación.', 'integracion', true, 14, 'critico'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-003', 'Firma electrónica avanzada',
     'Documentos oficiales deben firmarse con FEA según Ley 19.799.', 'seguridad', true, 18, 'alto'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-004', 'Dashboard ejecutivo con Power BI',
     'Reportería gerencial con tableros actualizados diariamente.', 'dashboard', false, 22, 'medio'),
    ('33333333-0000-0000-0000-000000000001', 'RQ-005', 'Capacitación a 50 funcionarios',
     'Plan de capacitación presencial para 50 funcionarios en 3 módulos.', 'capacitacion', true, 30, 'medio');
  end if;
end $seed$;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from technical_variables where document_id = '33333333-0000-0000-0000-000000000001') then
  insert into technical_variables (document_id, category, name, description, page, confidence) values
    ('33333333-0000-0000-0000-000000000001', 'sistema', 'Sistema de Gestión Municipal', 'Plataforma integral web', 8, 0.98),
    ('33333333-0000-0000-0000-000000000001', 'modulo', 'Rentas y Patentes', 'Gestión de rentas municipales', 12, 0.97),
    ('33333333-0000-0000-0000-000000000001', 'integracion', 'Tesorería General de la República', 'Conciliación de ingresos', 14, 0.96),
    ('33333333-0000-0000-0000-000000000001', 'seguridad', 'Firma Electrónica Avanzada', 'Ley 19.799', 18, 0.95),
    ('33333333-0000-0000-0000-000000000001', 'sla', 'Disponibilidad 99.5%', 'Medida mensualmente, con multas', 25, 0.93),
    ('33333333-0000-0000-0000-000000000001', 'capacitacion', 'Capacitación 50 funcionarios', '3 módulos presenciales', 30, 0.94);
  end if;
end $seed$;

insert into timelines (id, document_id, title) values
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
   'Cronograma Sistema de Gestión Municipal')
on conflict (id) do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from milestones where timeline_id = '55555555-0000-0000-0000-000000000001') then
  insert into milestones (timeline_id, milestone_type, title, starts_on, ends_on, sort_order) values
    ('55555555-0000-0000-0000-000000000001', 'inicio', 'Firma de contrato e inicio', '2026-05-01', '2026-05-01', 0),
    ('55555555-0000-0000-0000-000000000001', 'implementacion', 'Implementación módulos core', '2026-05-02', '2026-09-30', 1),
    ('55555555-0000-0000-0000-000000000001', 'capacitacion', 'Capacitación funcionarios', '2026-09-01', '2026-10-15', 2),
    ('55555555-0000-0000-0000-000000000001', 'marcha_blanca', 'Marcha blanca', '2026-10-16', '2026-12-15', 3),
    ('55555555-0000-0000-0000-000000000001', 'recepcion', 'Recepción conforme', '2026-12-20', '2026-12-20', 4),
    ('55555555-0000-0000-0000-000000000001', 'garantia', 'Período de garantía', '2026-12-21', '2027-12-20', 5),
    ('55555555-0000-0000-0000-000000000001', 'soporte', 'Soporte y mantención', '2026-12-21', '2028-04-30', 6),
    ('55555555-0000-0000-0000-000000000001', 'termino', 'Término de contrato', '2028-04-30', '2028-04-30', 7);
  end if;
end $seed$;

-- Documento de control interno de entregas (lo realmente entregado)
insert into documents (id, organization_id, client_id, project_id, title, doc_type, status,
  tender_number, doc_date, country, language)
values (
  '33333333-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  '22222222-0000-0000-0000-000000000001',
  '66666666-0000-0000-0000-000000000001',
  'EJEMPLO — Control Interno de Entregas SGM Puerto Montt',
  'control_entregas', 'procesado',
  '2397-45-LR26', '2026-07-28', 'Chile', 'es'
)
on conflict (id) do nothing;

insert into document_versions (id, document_id, version, is_current) values
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 1, true)
on conflict (id) do nothing;

-- Estas filas no tienen clave natural sobre la que hacer ON CONFLICT
-- (su id se genera en cada inserción), así que un ON CONFLICT DO NOTHING
-- no evitaría duplicarlas al reejecutar el archivo. Se siembran solo si
-- el documento de ejemplo aún no las tiene.
do $seed$ begin
  if not exists (select 1 from delivered_items where document_id = '33333333-0000-0000-0000-000000000002') then
  insert into delivered_items (document_id, title, description, delivered_on, delivery_state,
    is_additional, is_free, requirement_ref, page, confidence) values
    ('33333333-0000-0000-0000-000000000002', 'Módulo de Rentas y Patentes',
     'En producción, recepcionado conforme', '2026-06-15', 'entregado', false, false, 'RQ-001', 4, 0.97),
    ('33333333-0000-0000-0000-000000000002', 'Firma electrónica avanzada',
     'FEA operativa integrada con E-Sign', '2026-07-01', 'entregado', false, false, 'RQ-003', 6, 0.95),
    ('33333333-0000-0000-0000-000000000002', 'Tableros Power BI de Rentas',
     'Publicados; pendientes los de Circulación', '2026-07-10', 'en_progreso', false, false, 'RQ-004', 7, 0.90),
    ('33333333-0000-0000-0000-000000000002', 'Capacitación 52 funcionarios',
     'Superó la meta de 50; asistencia firmada', '2026-07-20', 'entregado', false, false, 'RQ-005', 9, 0.96),
    ('33333333-0000-0000-0000-000000000002', 'Portal de pagos Webpay',
     'Pasarela no exigida en bases, habilitada sin costo', '2026-07-05', 'entregado', true, true, null, 10, 0.94),
    ('33333333-0000-0000-0000-000000000002', 'Notificaciones por WhatsApp',
     'Avisos de vencimiento de patentes; mejora de cortesía sin costo', '2026-07-18', 'entregado', true, true, null, 11, 0.92);
  end if;
end $seed$;

insert into tags (organization_id, name, color) values
  ('11111111-1111-1111-1111-111111111111', 'urgente', '#ef4444'),
  ('11111111-1111-1111-1111-111111111111', 'en-evaluacion', '#f59e0b'),
  ('11111111-1111-1111-1111-111111111111', 'adjudicada', '#22c55e')
on conflict do nothing;

-- ─── Alta automática de usuarios ────────────────────────────────────────────
-- Cada usuario que crees en Authentication obtiene su perfil automáticamente.
-- El PRIMERO es Administrador; los siguientes entran como Usuario.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
  existing_users int;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is null then
    insert into organizations (name, slug) values ('Mi Organización', 'principal')
    returning id into org_id;
  end if;

  select count(*) into existing_users from profiles where organization_id = org_id;

  insert into profiles (id, organization_id, email, full_name, role)
  values (
    new.id, org_id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    case when existing_users = 0 then 'admin'::user_role else 'usuario'::user_role end
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Si ya habías creado usuarios antes de ejecutar esto, se les crea el perfil
-- ahora (el más antiguo queda como Administrador).
insert into profiles (id, organization_id, email, full_name, role)
select u.id, '11111111-1111-1111-1111-111111111111', coalesce(u.email, ''),
       split_part(coalesce(u.email, 'usuario'), '@', 1),
       case when row_number() over (order by u.created_at) = 1
            then 'admin'::user_role else 'usuario'::user_role end
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ============================================================================
-- Checklist de sistemas, requerimientos críticos, comentarios con adjuntos y
-- borrado de documentos (equivale a la migración 0009).
-- ============================================================================

-- ─── 1. Sistemas y sus funcionalidades ──────────────────────────────────────

create table if not exists systems (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  name          text not null,
  description   text,
  deadline_text text,          -- plazo tal como aparece ("60 días desde la firma")
  deadline_date date,          -- solo si el documento da una fecha concreta
  page          int,
  quote         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_systems_doc on systems(document_id);

create table if not exists system_features (
  id            uuid primary key default gen_random_uuid(),
  system_id     uuid not null references systems(id) on delete cascade,
  -- document_id denormalizado: permite que RLS resuelva el permiso sin join
  -- y que el checklist se cargue de una sola consulta.
  document_id   uuid not null references documents(id) on delete cascade,
  name          text not null,
  description   text,
  deadline_text text,
  deadline_date date,
  page          int,
  quote         text,
  is_mandatory  boolean not null default true,
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  completed_by  uuid references profiles(id) on delete set null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_features_system on system_features(system_id);
create index if not exists idx_features_doc on system_features(document_id);

drop trigger if exists trg_features_updated on system_features;
create trigger trg_features_updated before update on system_features
  for each row execute function set_updated_at();

alter table systems enable row level security;
alter table system_features enable row level security;

drop policy if exists systems_select on systems;
create policy systems_select on systems for select
  using (can_read_document(document_id));

drop policy if exists features_select on system_features;
create policy features_select on system_features for select
  using (can_read_document(document_id));

-- Marcar una funcionalidad como completada es la acción central del checklist:
-- la hace el usuario desde el navegador, con su propia sesión.
drop policy if exists features_update on system_features;
create policy features_update on system_features for update
  using (can_read_document(document_id))
  with check (can_read_document(document_id));

-- ─── 2. Requerimientos críticos ─────────────────────────────────────────────
-- null ⇒ el requerimiento no es de los que condicionan la participación.

alter table requirements
  add column if not exists critical_type text;

create index if not exists idx_requirements_critical
  on requirements(document_id, critical_type)
  where critical_type is not null;

-- ─── 3. Comparación del checklist contra un Excel ───────────────────────────
-- El Excel no es un documento de la biblioteca (no se indexa ni se analiza):
-- es un archivo de control que se sube, se lee y se compara en el momento.

create table if not exists checklist_comparisons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_id     uuid not null references documents(id) on delete cascade,
  file_name       text not null,
  total_features  int not null default 0,
  matched         int not null default 0,   -- funcionalidades del documento presentes en el Excel
  completed       int not null default 0,   -- ...y marcadas como entregadas/completadas
  missing         int not null default 0,   -- del documento y ausentes en el Excel
  extra           int not null default 0,   -- en el Excel y NO exigidas por el documento
  pct_completed   real not null default 0,
  result          jsonb not null,           -- detalle por sistema + extras destacados
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_checklist_cmp_doc on checklist_comparisons(document_id);

alter table checklist_comparisons enable row level security;

drop policy if exists checklist_cmp_select on checklist_comparisons;
create policy checklist_cmp_select on checklist_comparisons for select
  using (organization_id = current_org_id() and can_read_document(document_id));

drop policy if exists checklist_cmp_insert on checklist_comparisons;
create policy checklist_cmp_insert on checklist_comparisons for insert
  with check (organization_id = current_org_id() and can_read_document(document_id));

drop policy if exists checklist_cmp_delete on checklist_comparisons;
create policy checklist_cmp_delete on checklist_comparisons for delete
  using (organization_id = current_org_id()
         and (current_role_of() in ('admin','supervisor') or created_by = auth.uid()));

-- ─── 4. Comentarios con archivos adjuntos ───────────────────────────────────

create table if not exists note_attachments (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_note_attachments_note on note_attachments(note_id);

alter table note_attachments enable row level security;

drop policy if exists note_attachments_select on note_attachments;
create policy note_attachments_select on note_attachments for select
  using (exists (select 1 from notes n
                 where n.id = note_id and can_read_document(n.document_id)));

drop policy if exists note_attachments_insert on note_attachments;
create policy note_attachments_insert on note_attachments for insert
  with check (exists (select 1 from notes n
                      where n.id = note_id and n.user_id = auth.uid()));

drop policy if exists note_attachments_delete on note_attachments;
create policy note_attachments_delete on note_attachments for delete
  using (exists (select 1 from notes n
                 where n.id = note_id and n.user_id = auth.uid()));

-- Bucket propio para adjuntos: sin la lista blanca de MIME del bucket
-- 'documents' (un comentario puede llevar una captura de pantalla, un correo…).
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

drop policy if exists storage_attachments_read on storage.objects;
create policy storage_attachments_read on storage.objects for select
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists storage_attachments_insert on storage.objects;
create policy storage_attachments_insert on storage.objects for insert
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[1] = current_org_id()::text);

drop policy if exists storage_attachments_delete on storage.objects;
create policy storage_attachments_delete on storage.objects for delete
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1] = current_org_id()::text);

-- ─── 5. Borrado de documentos ───────────────────────────────────────────────
-- Antes solo un admin podía borrar, lo que dejaba sin salida a quien subía un
-- documento equivocado. Ahora también puede borrarlo quien lo subió (y los
-- supervisores). El borrado en cascada limpia versiones, páginas, fragmentos,
-- análisis, notas y comparaciones asociadas.

drop policy if exists documents_delete on documents;
create policy documents_delete on documents for delete
  using (organization_id = current_org_id()
         and (current_role_of() in ('admin','supervisor') or created_by = auth.uid()));

drop policy if exists storage_docs_delete on storage.objects;
create policy storage_docs_delete on storage.objects for delete
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = current_org_id()::text);

-- ============================================================================
-- Plazo de implementación y presupuesto en el resumen, plazo por punto
-- crítico (incluida la migración de datos), y motor por versión del
-- documento (equivale a la migración 0010).
-- ============================================================================

alter table document_summaries
  add column if not exists implementation_deadline text,
  add column if not exists budget_amount   real,
  add column if not exists budget_currency text,
  add column if not exists budget_period   text,
  add column if not exists budget_detail   text;

alter table requirements
  add column if not exists deadline_text text;

alter table document_versions
  add column if not exists analysis_engine text;

-- ============================================================================
-- Comparador de dos documentos: resumen macro en viñetas y página de origen
-- de cada diferencia en cada documento (equivale a la migración 0011).
-- ============================================================================

alter table comparisons
  add column if not exists summary_points jsonb;

-- ============================================================================
-- Registro de consumo real de IA por proveedor (equivale a la migración 0012)
-- ============================================================================

create table if not exists ai_usage_log (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  provider         text not null,
  model            text not null,
  feature          text not null,
  input_tokens     int not null default 0,
  output_tokens    int not null default 0,
  document_id      uuid references documents(id) on delete set null,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_ai_usage_org_created on ai_usage_log(organization_id, created_at desc);
create index if not exists idx_ai_usage_org_provider on ai_usage_log(organization_id, provider, created_at desc);

alter table ai_usage_log enable row level security;

drop policy if exists ai_usage_select on ai_usage_log;
create policy ai_usage_select on ai_usage_log for select
  using (organization_id = current_org_id());

-- ============================================================================
-- ✔ Instalación completa. Siguiente paso: Authentication → Users → Add user.
-- ============================================================================
