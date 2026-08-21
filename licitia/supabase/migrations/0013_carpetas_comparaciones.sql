-- ============================================================================
-- LicitIA — Carpetas para comparaciones. Viven dentro de la misma carpeta
-- general (projects) que los documentos, pero en su propia subcarpeta —
-- comparisons.project_id + comparisons.folder_id nunca se mezclan con
-- documents.project_id: una comparación puede archivarse en un proyecto sin
-- que eso mueva ni el documento origen ni el destino.
-- ============================================================================

create table if not exists comparison_folders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  name             text not null,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (project_id, name)
);
create index if not exists idx_comparison_folders_project on comparison_folders(project_id);

alter table comparisons
  add column if not exists project_id uuid references projects(id) on delete set null,
  add column if not exists folder_id  uuid references comparison_folders(id) on delete set null;
create index if not exists idx_comparisons_project on comparisons(project_id);
create index if not exists idx_comparisons_folder on comparisons(folder_id);

alter table comparison_folders enable row level security;

drop policy if exists comparison_folders_select on comparison_folders;
create policy comparison_folders_select on comparison_folders for select
  using (organization_id = current_org_id());
drop policy if exists comparison_folders_insert on comparison_folders;
create policy comparison_folders_insert on comparison_folders for insert
  with check (organization_id = current_org_id());
drop policy if exists comparison_folders_delete on comparison_folders;
create policy comparison_folders_delete on comparison_folders for delete
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- comparisons nunca tuvo política de update (solo se creaban, nunca se
-- editaban): hace falta para poder archivarlas en carpeta/subcarpeta.
drop policy if exists comparisons_update on comparisons;
create policy comparisons_update on comparisons for update
  using (organization_id = current_org_id() and can_read_document(source_document_id));
