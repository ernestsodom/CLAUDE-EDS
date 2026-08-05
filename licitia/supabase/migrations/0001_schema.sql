-- ============================================================================
-- LicitIA — Esquema principal
-- PostgreSQL 15+ / Supabase. Requiere extensiones pgvector y pg_trgm.
-- Embeddings: text-embedding-3-small → vector(1536).
-- ============================================================================

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type user_role as enum ('admin', 'supervisor', 'usuario');

create type document_type as enum (
  'licitacion', 'bases_administrativas', 'bases_tecnicas',
  'propuesta_comercial', 'propuesta_tecnica', 'carta_gantt',
  'contrato', 'anexo', 'reclamo', 'informe', 'acta', 'avance', 'otro'
);

create type document_status as enum (
  'subido', 'procesando', 'procesado', 'error', 'archivado'
);

create type processing_step as enum (
  'extraccion_texto', 'ocr', 'chunking', 'embeddings',
  'clasificacion', 'resumen', 'variables', 'timeline', 'completado'
);

create type requirement_status as enum (
  'cumplido', 'parcial', 'pendiente', 'no_aplica', 'fuera_de_alcance', 'adicional'
);

create type risk_level as enum ('bajo', 'medio', 'alto', 'critico');

create type variable_category as enum (
  'sistema', 'modulo', 'funcionalidad', 'integracion', 'api', 'reporte',
  'dashboard', 'interfaz', 'servicio_web', 'base_datos', 'infraestructura',
  'seguridad', 'backup', 'migracion', 'capacitacion', 'implementacion',
  'mesa_ayuda', 'soporte', 'sla', 'hardware', 'software', 'licencia',
  'multa', 'garantia', 'certificacion', 'personal', 'experiencia', 'otro'
);

create type milestone_type as enum (
  'inicio', 'hito', 'capacitacion', 'implementacion', 'marcha_blanca',
  'recepcion', 'garantia', 'soporte', 'termino', 'entregable', 'otro'
);

create type comparison_type as enum (
  'cumplimiento', 'licitacion_vs_licitacion', 'propuesta_vs_propuesta',
  'contrato_vs_contrato', 'version_vs_version'
);

create type claim_status as enum ('nuevo', 'analizado', 'respondido', 'cerrado');

-- ─── Organizaciones y usuarios ──────────────────────────────────────────────

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Perfil 1:1 con auth.users (Supabase Auth).
create table profiles (
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

create index idx_profiles_org on profiles(organization_id);

-- ─── Clientes ───────────────────────────────────────────────────────────────

create table clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  kind            text,              -- municipio | empresa | institucion | otro
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

create index idx_clients_org on clients(organization_id);
create index idx_clients_name_trgm on clients using gin (name gin_trgm_ops);

-- ─── Documentos ─────────────────────────────────────────────────────────────

create table documents (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  parent_document_id uuid references documents(id) on delete set null, -- p.ej. extraído de un ZIP
  title             text not null,
  doc_type          document_type not null default 'otro',
  status            document_status not null default 'subido',
  processing_step   processing_step,
  processing_error  text,
  -- Metadatos clasificados por IA (columnas tipadas para filtros rápidos)
  tender_number     text,             -- número de licitación
  tender_name       text,             -- nombre de la licitación
  market_id         text,             -- ID Mercado Público
  provider          text,
  area              text,
  project_type      text,
  country           text,
  region            text,
  city              text,
  doc_date          date,
  amount            numeric(18,2),
  currency          text default 'CLP',
  contract_duration text,
  language          text default 'es',
  doc_state         text,             -- estado declarado del documento
  page_count        int,
  is_scanned        boolean not null default false,
  classification    jsonb,            -- JSON estructurado completo devuelto por la IA
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_documents_org on documents(organization_id);
create index idx_documents_client on documents(client_id);
create index idx_documents_type on documents(doc_type);
create index idx_documents_status on documents(status);
create index idx_documents_date on documents(doc_date);
create index idx_documents_tender on documents(tender_number);
create index idx_documents_title_trgm on documents using gin (title gin_trgm_ops);

-- Versiones de documento (cada subida de una nueva versión crea una fila)
create table document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  version      int not null,
  change_note  text,
  is_current   boolean not null default true,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (document_id, version)
);

create index idx_versions_doc on document_versions(document_id);

-- Archivos físicos en Supabase Storage (1 versión → 1+ archivos)
create table files (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references document_versions(id) on delete cascade,
  storage_path  text not null,      -- bucket 'documents'
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  checksum_sha256 text,
  created_at    timestamptz not null default now()
);

create index idx_files_version on files(version_id);

-- Texto completo extraído, por página (para citas exactas página/sección)
create table document_pages (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references document_versions(id) on delete cascade,
  page_number  int not null,
  content      text not null,
  ocr_used     boolean not null default false,
  unique (version_id, page_number)
);

create index idx_pages_version on document_pages(version_id);

-- Chunks + embeddings (unidad de recuperación RAG)
create table document_chunks (
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

create index idx_chunks_doc on document_chunks(document_id);
create index idx_chunks_tsv on document_chunks using gin (tsv);
-- HNSW: buen recall con miles→millones de chunks sin reentrenar listas
create index idx_chunks_embedding on document_chunks
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- Metadatos arbitrarios clave/valor (extensible sin migraciones)
create table document_metadata (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  key          text not null,
  value        text,
  value_json   jsonb,
  source       text not null default 'ia',   -- ia | manual
  unique (document_id, key)
);

create index idx_metadata_doc on document_metadata(document_id);
create index idx_metadata_key on document_metadata(key);

-- ─── Análisis IA por documento ──────────────────────────────────────────────

-- Resumen ejecutivo generado automáticamente
create table document_summaries (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references documents(id) on delete cascade,
  version_id     uuid not null references document_versions(id) on delete cascade,
  summary        text,             -- resumen general
  objective      text,
  scope          text,
  problems       jsonb,            -- [{titulo, detalle}]
  requirements   jsonb,
  obligations    jsonb,
  restrictions   jsonb,
  risks          jsonb,            -- [{riesgo, nivel, mitigacion}]
  critical_points jsonb,
  deliverables   jsonb,
  schedule       jsonb,
  recommendations jsonb,
  model          text,
  created_at     timestamptz not null default now(),
  unique (version_id)
);

-- Variables técnicas extraídas individualmente (consultables/cruzables)
create table technical_variables (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  category     variable_category not null,
  name         text not null,
  description  text,
  value        text,
  page         int,
  quote        text,             -- cita textual de respaldo
  confidence   real,             -- 0..1
  created_at   timestamptz not null default now()
);

create index idx_tech_vars_doc on technical_variables(document_id);
create index idx_tech_vars_cat on technical_variables(category);
create index idx_tech_vars_name_trgm on technical_variables using gin (name gin_trgm_ops);

-- Requerimientos individuales (base del comparador de cumplimiento)
create table requirements (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  code         text,             -- p.ej. RQ-014
  title        text not null,
  description  text,
  category     text,
  mandatory    boolean default true,
  page         int,
  quote        text,
  priority     risk_level default 'medio',
  created_at   timestamptz not null default now()
);

create index idx_requirements_doc on requirements(document_id);

-- ─── Cronogramas / Línea de tiempo ──────────────────────────────────────────

create table timelines (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  title        text not null default 'Cronograma del proyecto',
  generated_by text not null default 'ia',
  created_at   timestamptz not null default now(),
  unique (document_id)
);

create table milestones (
  id           uuid primary key default gen_random_uuid(),
  timeline_id  uuid not null references timelines(id) on delete cascade,
  milestone_type milestone_type not null default 'hito',
  title        text not null,
  description  text,
  starts_on    date,
  ends_on      date,
  duration_label text,           -- "30 días corridos", "semana 4", etc.
  page         int,
  quote        text,
  sort_order   int not null default 0
);

create index idx_milestones_timeline on milestones(timeline_id);

-- ─── Conversaciones IA ──────────────────────────────────────────────────────

create table conversations (
  id           uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  document_id  uuid references documents(id) on delete cascade, -- null = biblioteca completa
  agent        text not null default 'analista',  -- analista | comparador | reclamos | propuestas | comercial
  title        text not null default 'Nueva conversación',
  is_favorite  boolean not null default false,
  duplicated_from uuid references conversations(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_conversations_user on conversations(user_id);
create index idx_conversations_doc on conversations(document_id);

create table conversation_tags (
  conversation_id uuid not null references conversations(id) on delete cascade,
  tag             text not null,
  primary key (conversation_id, tag)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  citations       jsonb,          -- [{chunk_id, document_id, page, section, quote}]
  confidence      real,
  model           text,
  token_usage     jsonb,
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id);

-- ─── Comparaciones ──────────────────────────────────────────────────────────

create table comparisons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  comparison_type comparison_type not null,
  source_document_id uuid not null references documents(id) on delete cascade,
  target_document_id uuid not null references documents(id) on delete cascade,
  status          text not null default 'procesando', -- procesando | completado | error
  pct_fulfilled   real,
  pct_partial     real,
  pct_pending     real,
  pct_additional  real,
  pct_out_of_scope real,
  traffic_light   text,           -- verde | amarillo | rojo
  summary         text,
  differences     jsonb,          -- para comparaciones doc vs doc (no cumplimiento)
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_comparisons_org on comparisons(organization_id);
create index idx_comparisons_source on comparisons(source_document_id);

create table comparison_items (
  id              uuid primary key default gen_random_uuid(),
  comparison_id   uuid not null references comparisons(id) on delete cascade,
  requirement_id  uuid references requirements(id) on delete set null,
  requirement_text text not null,
  status          requirement_status not null,
  evidence_quote  text,
  evidence_document_id uuid references documents(id) on delete set null,
  evidence_page   int,
  ai_comment      text,
  risk            risk_level not null default 'medio',
  priority        risk_level not null default 'medio',
  sort_order      int not null default 0
);

create index idx_comparison_items_cmp on comparison_items(comparison_id);

-- ─── Reclamos ───────────────────────────────────────────────────────────────

create table claims (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  contract_document_id uuid references documents(id) on delete set null,
  subject         text,
  raw_email       text not null,   -- correo pegado por el usuario
  status          claim_status not null default 'nuevo',
  analysis        jsonb,           -- {reclama, solicita, contrato, requerimiento, entregado, pendiente, fuera_contrato, adicionales, riesgos}
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_claims_org on claims(organization_id);

create table claim_responses (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references claims(id) on delete cascade,
  content      text not null,     -- respuesta profesional redactada
  citations    jsonb,             -- evidencia citada
  model        text,
  approved     boolean not null default false,
  approved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_claim_responses_claim on claim_responses(claim_id);

-- ─── Notas y etiquetas ──────────────────────────────────────────────────────

create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text default '#6366f1',
  unique (organization_id, name)
);

create table document_tags (
  document_id uuid not null references documents(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

create table notes (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         text not null default 'comentario', -- comentario | observacion | pendiente | recordatorio
  content      text not null,
  page         int,
  due_date     date,              -- para recordatorios/pendientes
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_notes_doc on notes(document_id);
create index idx_notes_user on notes(user_id);

-- ─── Permisos por documento ─────────────────────────────────────────────────
-- admin/supervisor ven todo su org; 'usuario' solo documentos con grant.
create table document_permissions (
  document_id uuid not null references documents(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  can_write   boolean not null default false,
  granted_by  uuid references profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);

-- ─── Auditoría y configuración ──────────────────────────────────────────────

create table audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references organizations(id) on delete set null,
  user_id         uuid,
  action          text not null,   -- document.upload, chat.message, claim.respond, ...
  entity_type     text,
  entity_id       uuid,
  detail          jsonb,
  ip              inet,
  created_at      timestamptz not null default now()
);

create index idx_audit_org_date on audit_logs(organization_id, created_at desc);

create table app_settings (
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
  foreach t in array array['organizations','profiles','clients','documents',
    'conversations','comparisons','claims','notes']
  loop
    execute format(
      'create trigger trg_%s_updated before update on %s for each row execute function set_updated_at()',
      t, t);
  end loop;
end $$;
