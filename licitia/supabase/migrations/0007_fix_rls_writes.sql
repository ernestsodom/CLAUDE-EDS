-- ============================================================================
-- LicitIA — Corrección de RLS para las escrituras del usuario
--
-- Dos defectos detectados en producción al subir un documento:
--
-- 1. documents_select llamaba a can_read_document(id), que vuelve a consultar
--    la propia tabla documents. Al ser una función STABLE, su instantánea no
--    incluye la fila recién insertada por la sentencia en curso, de modo que
--    `INSERT ... RETURNING` (que exige política de SELECT sobre la fila nueva)
--    fallaba con "new row violates row-level security policy".
--    Solución: expresar la condición sobre las columnas de la propia fila,
--    sin auto-consulta. Además evita una consulta extra por fila.
--
-- 2. document_versions y files tenían RLS activo pero SOLO política de SELECT.
--    La ruta de subida las escribe con el cliente del usuario (no con
--    service_role), por lo que sus INSERT/UPDATE quedaban denegados.
--    Solución: políticas de escritura acotadas a la organización del usuario.
--
-- También se permite UPDATE en storage.objects para que la subida con
-- upsert pueda sobrescribir un archivo del mismo proyecto.
-- ============================================================================

-- ─── 1. documents: SELECT sin auto-consulta ─────────────────────────────────
--
-- El permiso explícito se consulta con una función SECURITY DEFINER: si la
-- política leyera document_permissions directamente se produciría recursión
-- infinita, porque la política de esa tabla consulta a su vez documents.

create or replace function has_document_permission(doc_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from document_permissions p
    where p.document_id = doc_id and p.user_id = auth.uid()
  );
$$;

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

-- ─── 2. document_versions: escritura ────────────────────────────────────────

drop policy if exists versions_insert on document_versions;
create policy versions_insert on document_versions for insert
  with check (exists (select 1 from documents d
                      where d.id = document_id and d.organization_id = current_org_id()));

drop policy if exists versions_update on document_versions;
create policy versions_update on document_versions for update
  using (exists (select 1 from documents d
                 where d.id = document_id and d.organization_id = current_org_id()));

-- ─── 3. files: escritura ────────────────────────────────────────────────────

drop policy if exists files_insert on files;
create policy files_insert on files for insert
  with check (exists (select 1 from document_versions v
                      join documents d on d.id = v.document_id
                      where v.id = version_id and d.organization_id = current_org_id()));

drop policy if exists files_update on files;
create policy files_update on files for update
  using (exists (select 1 from document_versions v
                 join documents d on d.id = v.document_id
                 where v.id = version_id and d.organization_id = current_org_id()));

-- ─── 4. storage: permitir sobrescritura (upsert) ────────────────────────────

drop policy if exists storage_docs_update on storage.objects;
create policy storage_docs_update on storage.objects for update
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = current_org_id()::text);
