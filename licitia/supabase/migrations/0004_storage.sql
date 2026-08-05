-- ============================================================================
-- LicitIA — Buckets de Storage y políticas
-- Estructura de rutas: documents/{organization_id}/{document_id}/{version}/{file}
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- Lectura: solo archivos de la organización del usuario (primer segmento de la ruta)
create policy storage_docs_read on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

-- Subida: usuarios autenticados dentro de su organización
create policy storage_docs_insert on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
  );

-- Borrado: solo admin
create policy storage_docs_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_org_id()::text
    and current_role_of() = 'admin'
  );

create policy storage_exports_rw on storage.objects for all
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] = current_org_id()::text
  );
