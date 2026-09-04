-- Primer paso de la entidad "Licitación" del prompt maestro — reutilizando
-- lo que ya existe (una carpeta/proyecto agrupa varios documentos: bases
-- técnicas, bases administrativas, anexos, aclaraciones) en vez de crear una
-- tabla y una jerarquía nuevas en paralelo. La carpeta pasa a poder llevar
-- los datos propios de la licitación que agrupa; sigue funcionando igual
-- como carpeta simple cuando esos campos quedan vacíos.
--
-- No se toca ninguna política de RLS: projects_update ya cubre estas
-- columnas (mismo criterio que el resto de la fila).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS tender_number text,
  ADD COLUMN IF NOT EXISTS tender_status text
    CHECK (tender_status IS NULL OR tender_status IN (
      'en_preparacion', 'publicada', 'en_evaluacion', 'adjudicada', 'cerrada', 'desierta'
    )),
  ADD COLUMN IF NOT EXISTS closing_date date;

COMMENT ON COLUMN public.projects.tender_number IS 'N° de licitación (ID Mercado Público u otro), si esta carpeta agrupa los documentos de una licitación puntual.';
COMMENT ON COLUMN public.projects.tender_status IS 'Estado de la licitación que agrupa esta carpeta — null cuando la carpeta no representa una licitación (uso genérico).';
COMMENT ON COLUMN public.projects.closing_date IS 'Fecha de cierre de la licitación (recepción de ofertas), si aplica.';
