-- =====================================================================
-- 016_documents.sql
-- Gestion documental polimorfica + versionado + extracciones IA +
-- aprobaciones.
--
-- REGLA: los archivos viven en Supabase Storage. PostgreSQL guarda
-- SOLO metadatos (bucket, storage_path, mime_type, file_size, hash).
-- La asociacion a entidades se hace por document_links (N:M), nunca
-- con columnas dedicadas por entidad.
-- =====================================================================

create table public.document_types (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  category      text not null,          -- COMERCIAL | LEGAL | TECNICO | FINANCIERO | LOGISTICO | CALIDAD
  bucket        text not null default 'documents',
  requires_approval boolean not null default false,
  is_versioned  boolean not null default false,
  ai_extraction_type text,              -- INVOICE | BL | CONTRACT | QUOTE | null
  sort_order    integer not null default 100,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.document_types (code, name, category, bucket, requires_approval, is_versioned, ai_extraction_type) values
  ('COTIZACION',        'Cotizacion',              'COMERCIAL',  'quotes',    false, true,  'QUOTE'),
  ('CONTRATO',          'Contrato',                'LEGAL',      'contracts', true,  true,  'CONTRACT'),
  ('FACTURA_VENTA',     'Factura de venta',        'FINANCIERO', 'invoices',  false, false, 'INVOICE'),
  ('FACTURA_COMPRA',    'Factura de compra',       'FINANCIERO', 'invoices',  false, false, 'INVOICE'),
  ('ORDEN_COMPRA',      'Orden de compra',         'FINANCIERO', 'documents', true,  false, null),
  ('DISENO',            'Diseno / Plano',          'TECNICO',    'designs',   true,  true,  null),
  ('ESPECIFICACION',    'Especificacion tecnica',  'TECNICO',    'designs',   false, true,  null),
  ('BL',                'Bill of Lading',          'LOGISTICO',  'documents', false, false, 'BL'),
  ('PACKING_LIST',      'Packing list',            'LOGISTICO',  'documents', false, false, null),
  ('DUA_ADUANA',        'Documento de aduana',     'LOGISTICO',  'documents', false, false, null),
  ('CERTIFICADO',       'Certificado',             'CALIDAD',    'documents', false, false, null),
  ('ACTA_ENTREGA',      'Acta de entrega',         'CALIDAD',    'documents', true,  false, null),
  ('FOTO_FABRICACION',  'Fotografia de fabricacion','CALIDAD',   'photos',    false, false, null),
  ('FOTO_INSTALACION',  'Fotografia de instalacion','CALIDAD',   'photos',    false, false, null),
  ('COMPROBANTE_PAGO',  'Comprobante de pago',     'FINANCIERO', 'documents', false, false, null),
  ('OTRO',              'Otro documento',          'COMERCIAL',  'documents', false, false, null);

-- ---------------------------------------------------------------------
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete restrict,
  document_type_id  uuid not null references public.document_types(id) on delete restrict,
  name              text not null,
  description       text,
  bucket            text not null default 'documents',
  storage_path      text not null,
  mime_type         text,
  file_size         bigint,
  file_hash         text,
  current_version   integer not null default 1,
  status            document_status not null default 'VIGENTE',
  is_confidential   boolean not null default false,
  valid_from        date,
  valid_until       date,
  metadata          jsonb not null default '{}'::jsonb,
  uploaded_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint documents_storage_uk unique (bucket, storage_path),
  constraint documents_size_ck    check (file_size is null or file_size >= 0)
);

comment on column public.documents.storage_path is
  'Convencion: {PROJECT_CODE}/{entity_type}/{entity_id}/{uuid}_{filename}. Las Storage policies dependen del primer segmento.';

create index documents_project_idx      on public.documents (project_id) where deleted_at is null;
create index documents_type_idx         on public.documents (document_type_id) where deleted_at is null;
create index documents_project_date_idx on public.documents (project_id, created_at desc) where deleted_at is null;
create index documents_name_trgm_idx    on public.documents using gin (name gin_trgm_ops);
create index documents_metadata_idx     on public.documents using gin (metadata);

select app.attach_updated_at('public.documents');

alter table public.installations
  add constraint installations_signature_document_fk
  foreign key (signature_document_id) references public.documents(id) on delete set null;

-- ---------------------------------------------------------------------
-- Asociacion polimorfica documento <-> entidad
-- ---------------------------------------------------------------------
create table public.document_links (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  document_id   uuid not null references public.documents(id) on delete cascade,
  entity_type   entity_type not null,
  entity_id     uuid not null,
  relation      text,                 -- PRINCIPAL | ANEXO | FIRMADO | ...
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint document_links_uk unique (document_id, entity_type, entity_id)
);

create index document_links_entity_idx   on public.document_links (entity_type, entity_id);
create index document_links_document_idx on public.document_links (document_id);
create index document_links_project_idx  on public.document_links (project_id);

-- ---------------------------------------------------------------------
-- Versionado
-- ---------------------------------------------------------------------
create table public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  version         integer not null,
  bucket          text not null,
  storage_path    text not null,
  mime_type       text,
  file_size       bigint,
  file_hash       text,
  status          document_status not null default 'BORRADOR',
  comment         text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint document_versions_uk unique (document_id, version),
  constraint document_versions_version_ck check (version >= 1)
);

create index document_versions_document_idx on public.document_versions (document_id, version desc);

-- ---------------------------------------------------------------------
-- Extracciones IA (Human-in-the-loop obligatorio)
-- ---------------------------------------------------------------------
create table public.ai_document_extractions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  document_id      uuid not null references public.documents(id) on delete cascade,
  provider         text not null,                -- anthropic | openai | ...
  model            text not null,
  extraction_type  text not null,                -- INVOICE | BL | CONTRACT | QUOTE
  prompt_version   text,
  raw_response     jsonb,
  structured_data  jsonb,
  confidence       numeric(5,4),
  status           ai_extraction_status not null default 'PENDIENTE',
  error_message    text,
  tokens_input     integer,
  tokens_output    integer,
  -- Revision humana: obligatoria antes de aplicar datos al negocio
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  applied_at       timestamptz,
  applied_entity_type entity_type,
  applied_entity_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint ai_extractions_confidence_ck check (confidence is null or confidence between 0 and 1),
  constraint ai_extractions_review_ck check (
    status not in ('APROBADO','RECHAZADO') or reviewed_by is not null
  ),
  constraint ai_extractions_applied_ck check (
    applied_at is null or status = 'APROBADO'
  )
);

comment on constraint ai_extractions_applied_ck on public.ai_document_extractions is
  'Ningun dato extraido por IA se aplica al negocio sin revision y aprobacion humana.';

create index ai_extractions_document_idx on public.ai_document_extractions (document_id);
create index ai_extractions_status_idx   on public.ai_document_extractions (project_id, status);

select app.attach_updated_at('public.ai_document_extractions');

-- ---------------------------------------------------------------------
-- Aprobaciones genericas (disenos, cotizaciones, compras, ventas, docs)
-- ---------------------------------------------------------------------
create table public.approvals (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  entity_type       entity_type not null,
  entity_id         uuid not null,
  requested_by      uuid references public.profiles(id) on delete set null,
  requested_at      timestamptz not null default now(),
  approver_user_id  uuid references public.profiles(id) on delete set null,
  status            approval_status not null default 'PENDIENTE',
  decided_at        timestamptz,
  comment           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint approvals_decided_ck check (status = 'PENDIENTE' or decided_at is not null)
);

create index approvals_entity_idx  on public.approvals (entity_type, entity_id);
create index approvals_pending_idx on public.approvals (project_id, status) where status = 'PENDIENTE';

select app.attach_updated_at('public.approvals');
