-- Comparador Checklist vs Excel a nivel de licitación (carpeta), no solo por
-- documento: checklist_comparisons pasa a poder guardar el resultado contra
-- un project_id en vez de un document_id. Ambas columnas son mutuamente
-- excluyentes — exactamente una debe estar presente.

ALTER TABLE public.checklist_comparisons
  ALTER COLUMN document_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.checklist_comparisons
  ADD CONSTRAINT checklist_comparisons_scope_chk CHECK (
    (document_id IS NOT NULL AND project_id IS NULL) OR
    (document_id IS NULL AND project_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_checklist_cmp_project ON public.checklist_comparisons USING btree (project_id);

-- Mismo criterio que can_read_document, para el caso "licitación completa".
CREATE FUNCTION public.can_read_project(proj_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from projects p
    where p.id = proj_id
      and p.organization_id = current_org_id()
  );
$$;

DROP POLICY checklist_cmp_insert ON public.checklist_comparisons;
CREATE POLICY checklist_cmp_insert ON public.checklist_comparisons FOR INSERT WITH CHECK (
  (organization_id = public.current_org_id()) AND (
    (document_id IS NOT NULL AND public.can_read_document(document_id)) OR
    (project_id IS NOT NULL AND public.can_read_project(project_id))
  )
);

DROP POLICY checklist_cmp_select ON public.checklist_comparisons;
CREATE POLICY checklist_cmp_select ON public.checklist_comparisons FOR SELECT USING (
  (organization_id = public.current_org_id()) AND (
    (document_id IS NOT NULL AND public.can_read_document(document_id)) OR
    (project_id IS NOT NULL AND public.can_read_project(project_id))
  )
);
