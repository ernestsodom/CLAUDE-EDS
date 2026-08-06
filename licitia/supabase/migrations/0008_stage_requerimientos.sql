-- ============================================================================
-- LicitIA — Nueva etapa 'requerimientos' en el pipeline por etapas
--
-- El procesamiento se ejecuta ahora en tramos acotados (uno por petición)
-- para caber en el límite de duración de las funciones serverless. Cada
-- tramo se identifica con un valor de processing_step; la extracción de
-- requerimientos (o de entregas, en documentos de control) necesita el suyo.
-- ============================================================================

alter type processing_step add value if not exists 'requerimientos';
