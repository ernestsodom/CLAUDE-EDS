-- Permite borrar una funcionalidad del checklist de un sistema.
--
-- Hasta ahora system_features solo tenía políticas de SELECT y UPDATE
-- (features_select / features_update): se podía marcar como cumplida o
-- cambiarle el plazo, pero no eliminarla — necesario para sacar del
-- checklist (y por lo tanto del comparador Checklist vs Excel) una
-- funcionalidad mal extraída o duplicada, sin tener que reanalizar todo
-- el sistema.
--
-- Mismo criterio que features_update: quien puede leer el documento puede
-- editar su checklist.
CREATE POLICY features_delete ON public.system_features
  FOR DELETE USING (public.can_read_document(document_id));
