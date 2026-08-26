-- ============================================================================
-- Línea de tiempo: fechas calendario concretas para los plazos relativos
-- ("40 días corridos desde la firma del contrato"), calculadas desde la
-- fecha del documento. is_estimated distingue una fecha calculada por el
-- sistema de una que el documento indica literalmente — la interfaz nunca
-- debe mostrar una fecha estimada como si fuera un dato del documento.
-- ============================================================================

alter table milestones
  add column if not exists is_estimated boolean not null default false;
