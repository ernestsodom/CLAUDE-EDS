-- ============================================================================
-- LicitIA — Row Level Security
-- Modelo: multi-tenant por organización + permisos por documento.
--   admin/supervisor → todos los documentos de su organización
--   usuario          → solo documentos propios o con grant en document_permissions
-- El backend usa service_role (bypassa RLS) únicamente para el pipeline de
-- ingesta; toda lectura de usuario final pasa por estas políticas.
-- ============================================================================

alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table clients              enable row level security;
alter table documents            enable row level security;
alter table document_versions    enable row level security;
alter table files                enable row level security;
alter table document_pages       enable row level security;
alter table document_chunks      enable row level security;
alter table document_metadata    enable row level security;
alter table document_summaries   enable row level security;
alter table technical_variables  enable row level security;
alter table requirements         enable row level security;
alter table timelines            enable row level security;
alter table milestones           enable row level security;
alter table conversations        enable row level security;
alter table conversation_tags    enable row level security;
alter table messages             enable row level security;
alter table comparisons          enable row level security;
alter table comparison_items     enable row level security;
alter table claims               enable row level security;
alter table claim_responses      enable row level security;
alter table tags                 enable row level security;
alter table document_tags        enable row level security;
alter table notes                enable row level security;
alter table document_permissions enable row level security;
alter table audit_logs           enable row level security;
alter table app_settings         enable row level security;

-- ─── Organización / perfiles ────────────────────────────────────────────────

create policy org_select on organizations for select
  using (id = current_org_id());

create policy profiles_select on profiles for select
  using (organization_id = current_org_id());

create policy profiles_update_self on profiles for update
  using (id = auth.uid());

create policy profiles_admin_all on profiles for all
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- ─── Clientes ───────────────────────────────────────────────────────────────

create policy clients_select on clients for select
  using (organization_id = current_org_id());

create policy clients_write on clients for all
  using (organization_id = current_org_id()
         and current_role_of() in ('admin', 'supervisor'));

-- ─── Documentos y derivados ─────────────────────────────────────────────────

create policy documents_select on documents for select
  using (can_read_document(id));

create policy documents_insert on documents for insert
  with check (organization_id = current_org_id());

create policy documents_update on documents for update
  using (
    organization_id = current_org_id()
    and (current_role_of() in ('admin','supervisor')
         or created_by = auth.uid()
         or exists (select 1 from document_permissions p
                    where p.document_id = id and p.user_id = auth.uid() and p.can_write))
  );

create policy documents_delete on documents for delete
  using (organization_id = current_org_id() and current_role_of() = 'admin');

-- Tablas hijas: heredan visibilidad del documento
create policy versions_select  on document_versions   for select using (can_read_document(document_id));
create policy pages_select     on document_pages      for select
  using (exists (select 1 from document_versions v
                 where v.id = version_id and can_read_document(v.document_id)));
create policy files_select     on files               for select
  using (exists (select 1 from document_versions v
                 where v.id = version_id and can_read_document(v.document_id)));
create policy chunks_select    on document_chunks     for select using (can_read_document(document_id));
create policy metadata_select  on document_metadata   for select using (can_read_document(document_id));
create policy summaries_select on document_summaries  for select using (can_read_document(document_id));
create policy techvars_select  on technical_variables for select using (can_read_document(document_id));
create policy reqs_select      on requirements        for select using (can_read_document(document_id));
create policy timelines_select on timelines           for select using (can_read_document(document_id));
create policy milestones_select on milestones for select
  using (exists (select 1 from timelines t
                 where t.id = timeline_id and can_read_document(t.document_id)));

-- ─── Conversaciones (privadas por usuario) ──────────────────────────────────

create policy conversations_owner on conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy conv_tags_owner on conversation_tags for all
  using (exists (select 1 from conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()));

create policy messages_owner on messages for all
  using (exists (select 1 from conversations c
                 where c.id = conversation_id and c.user_id = auth.uid()));

-- ─── Comparaciones y reclamos ───────────────────────────────────────────────

create policy comparisons_select on comparisons for select
  using (organization_id = current_org_id()
         and can_read_document(source_document_id));

create policy comparisons_insert on comparisons for insert
  with check (organization_id = current_org_id());

create policy comparison_items_select on comparison_items for select
  using (exists (select 1 from comparisons c
                 where c.id = comparison_id
                   and c.organization_id = current_org_id()
                   and can_read_document(c.source_document_id)));

create policy claims_all on claims for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

create policy claim_responses_all on claim_responses for all
  using (exists (select 1 from claims c
                 where c.id = claim_id and c.organization_id = current_org_id()));

-- ─── Tags y notas ───────────────────────────────────────────────────────────

create policy tags_select on tags for select using (organization_id = current_org_id());
create policy tags_write  on tags for all
  using (organization_id = current_org_id());

create policy doc_tags_all on document_tags for all
  using (can_read_document(document_id));

create policy notes_select on notes for select using (can_read_document(document_id));
create policy notes_write  on notes for insert with check (user_id = auth.uid() and can_read_document(document_id));
create policy notes_update on notes for update using (user_id = auth.uid());
create policy notes_delete on notes for delete using (user_id = auth.uid());

-- ─── Permisos, auditoría, configuración ─────────────────────────────────────

create policy perms_select on document_permissions for select
  using (user_id = auth.uid()
         or (current_role_of() in ('admin','supervisor')
             and exists (select 1 from documents d
                         where d.id = document_id and d.organization_id = current_org_id())));

create policy perms_write on document_permissions for all
  using (current_role_of() in ('admin','supervisor')
         and exists (select 1 from documents d
                     where d.id = document_id and d.organization_id = current_org_id()));

create policy audit_select on audit_logs for select
  using (organization_id = current_org_id() and current_role_of() = 'admin');

create policy audit_insert on audit_logs for insert
  with check (organization_id = current_org_id());

create policy settings_select on app_settings for select
  using (organization_id = current_org_id());

create policy settings_write on app_settings for all
  using (organization_id = current_org_id() and current_role_of() = 'admin');
