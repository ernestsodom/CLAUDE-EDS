-- =====================================================================
-- 023_storage.sql
-- Buckets de Supabase Storage y sus politicas.
--
-- CONVENCION DE RUTA (obligatoria):
--   {PROJECT_CODE}/{entity_type}/{entity_id}/{uuid}_{filename}
--   ej: EUROPA/sale/6f1c.../a3d9..._contrato-firmado.pdf
--
-- El PRIMER segmento de la ruta es el codigo de proyecto y es lo que
-- las politicas usan para resolver permisos. Todos los buckets son
-- privados: el acceso se hace con signed URLs de corta duracion
-- generadas server-side.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800,
     array['application/pdf','image/png','image/jpeg','image/webp',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.ms-excel','text/csv','text/plain']),
  ('photos',    'photos',    false, 26214400,
     array['image/png','image/jpeg','image/webp','image/heic']),
  ('designs',   'designs',   false, 104857600,
     array['application/pdf','image/png','image/jpeg','image/svg+xml',
           'application/acad','image/vnd.dwg','application/dxf','application/octet-stream']),
  ('quotes',    'quotes',    false, 52428800,
     array['application/pdf','image/png','image/jpeg',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('invoices',  'invoices',  false, 52428800,
     array['application/pdf','image/png','image/jpeg','application/xml','text/xml']),
  ('contracts', 'contracts', false, 52428800,
     array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Helper: resuelve el project_id desde el primer segmento de la ruta.
-- ---------------------------------------------------------------------
create or replace function app.storage_project_id(p_name text)
returns uuid
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select p.id
    from public.projects p
   where p.code = split_part(p_name, '/', 1)
     and p.deleted_at is null;
$$;

-- ---------------------------------------------------------------------
-- Politicas por bucket. Se generan en bucle para mantenerlas coherentes.
--   SELECT  -> documents.view
--   INSERT  -> documents.upload
--   UPDATE  -> documents.update
--   DELETE  -> documents.delete
-- ---------------------------------------------------------------------
do $$
declare
  b text;
begin
  foreach b in array array['documents','photos','designs','quotes','invoices','contracts']
  loop
    execute format($p$
      drop policy if exists %1$s_read on storage.objects;
      create policy %1$s_read on storage.objects
        for select to authenticated
        using (
          bucket_id = %2$L
          and app.storage_project_id(name) in (select app.projects_with_permission('documents.view'))
        );
    $p$, b || '_objects', b);

    execute format($p$
      drop policy if exists %1$s_insert on storage.objects;
      create policy %1$s_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = %2$L
          and app.storage_project_id(name) in (select app.projects_with_permission('documents.upload'))
          and array_length(string_to_array(name, '/'), 1) >= 3
        );
    $p$, b || '_objects', b);

    execute format($p$
      drop policy if exists %1$s_update on storage.objects;
      create policy %1$s_update on storage.objects
        for update to authenticated
        using (
          bucket_id = %2$L
          and app.storage_project_id(name) in (select app.projects_with_permission('documents.update'))
        )
        with check (
          bucket_id = %2$L
          and app.storage_project_id(name) in (select app.projects_with_permission('documents.update'))
        );
    $p$, b || '_objects', b);

    execute format($p$
      drop policy if exists %1$s_delete on storage.objects;
      create policy %1$s_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = %2$L
          and app.storage_project_id(name) in (select app.projects_with_permission('documents.delete'))
        );
    $p$, b || '_objects', b);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Los contratos y facturas son documentacion legal/financiera: solo
-- quien tiene el permiso del modulo correspondiente puede leerlos.
-- Politica RESTRICTIVA: se suma (AND) a la permisiva anterior.
-- ---------------------------------------------------------------------
drop policy if exists contracts_objects_restrict on storage.objects;
create policy contracts_objects_restrict on storage.objects
  as restrictive
  for select to authenticated
  using (
    bucket_id <> 'contracts'
    or app.storage_project_id(name) in (select app.projects_with_permission('contracts.view'))
  );

drop policy if exists invoices_objects_restrict on storage.objects;
create policy invoices_objects_restrict on storage.objects
  as restrictive
  for select to authenticated
  using (
    bucket_id <> 'invoices'
    or app.storage_project_id(name) in (select app.projects_with_permission('invoices.view'))
  );

-- ---------------------------------------------------------------------
-- El esquema `app` no se expone via PostgREST, pero las policies de
-- Storage se evaluan como el usuario: necesita USAGE + EXECUTE.
-- ---------------------------------------------------------------------
grant usage on schema app to authenticated;
grant execute on function app.storage_project_id(text)        to authenticated;
grant execute on function app.projects_with_permission(text)  to authenticated;
grant execute on function app.accessible_project_ids()        to authenticated;
grant execute on function app.has_permission(uuid, text)      to authenticated;
grant execute on function app.has_project_access(uuid)        to authenticated;
grant execute on function app.is_super_admin()                to authenticated;
grant execute on function app.role_in_project(uuid)           to authenticated;

-- El resto de funciones de `app` (logica de negocio, motor de alertas,
-- auditoria) queda fuera del alcance del usuario final.
revoke execute on function app.generate_alerts()                       from public, authenticated;
revoke execute on function app.refresh_overdue_follow_ups()            from public, authenticated;
revoke execute on function app.upsert_alert(uuid, alert_type, priority_level, text, text, entity_type, uuid, text, jsonb)
  from public, authenticated;
revoke execute on function app.log_event(uuid, entity_type, uuid, text, text, text, jsonb)
  from public, authenticated;
revoke execute on function app.next_document_number(uuid, text, text, integer)
  from public, authenticated;
revoke execute on function app.sync_sale_delivery_status(uuid) from public, authenticated;
