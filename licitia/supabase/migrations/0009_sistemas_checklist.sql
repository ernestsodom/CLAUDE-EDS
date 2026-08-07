-- ============================================================================
-- LicitIA — Checklist de sistemas, requerimientos críticos, comentarios con
-- adjuntos y borrado de documentos.
--
-- 1. systems / system_features: el documento técnico deja de ser una lista
--    plana de "variables". Se extraen los SISTEMAS (software) que pide la
--    licitación y, colgando de cada uno, sus FUNCIONALIDADES concretas, cada
--    una con su plazo y una marca de completada → % de cumplimiento.
-- 2. requirements.critical_type: los requerimientos se acotan a lo crítico y
--    obligatorio para participar (boleta de garantía, servidores, SLA,
--    plazos, multas, certificados).
-- 3. checklist_comparisons: comparación del checklist contra un Excel con
--    formato predeterminado (ver docs/formato-excel.md).
-- 4. note_attachments: los comentarios admiten archivos adjuntos.
-- 5. Borrado de documentos por su autor (antes solo admin).
-- ============================================================================

alter type processing_step add value if not exists 'requerimientos';
alter type processing_step add value if not exists 'sistemas';

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
