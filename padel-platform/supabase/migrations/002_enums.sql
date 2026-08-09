-- =====================================================================
-- 002_enums.sql
-- Tipos enumerados del dominio.
-- Se usan ENUMs nativos para estados con maquina de estados estable y
-- tablas de catalogo (ej. cost_categories, document_types) para valores
-- que el ADMIN debe poder administrar desde la UI.
-- =====================================================================

-- ---------- Generales -------------------------------------------------
create type currency_code as enum ('EUR', 'USD', 'ARS', 'CLP');

create type priority_level as enum ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

create type entity_type as enum (
  'CLIENT', 'CONTACT', 'OPPORTUNITY', 'MEETING', 'FOLLOW_UP',
  'SALE', 'SALE_ITEM', 'SALE_COST', 'CONTRACT',
  'MANUFACTURING_PROJECT', 'COURT', 'MATERIAL_REQUIREMENT',
  'SUPPLIER', 'SUPPLIER_QUOTE', 'PURCHASE_ORDER',
  'INVOICE', 'PAYMENT', 'EXPENSE', 'BANK_TRANSACTION',
  'SHIPMENT', 'INSTALLATION', 'QUALITY_CHECK',
  'DOCUMENT', 'TASK', 'CHECKLIST', 'PROJECT', 'USER'
);

-- ---------- CRM -------------------------------------------------------
create type client_status as enum (
  'PROSPECTO', 'CONTACTADO', 'CALIFICADO', 'ACTIVO', 'INACTIVO', 'PERDIDO'
);

create type lead_source as enum (
  'REFERIDO', 'WEB', 'FERIA', 'REDES_SOCIALES', 'LLAMADA_FRIA',
  'CAMPANA', 'PARTNER', 'OTRO'
);

create type opportunity_status as enum (
  'NUEVA', 'CALIFICANDO', 'REUNION', 'COTIZADA', 'NEGOCIACION',
  'GANADA', 'PERDIDA', 'ARCHIVADA'
);

create type activity_type as enum (
  'LLAMADA', 'EMAIL', 'WHATSAPP', 'REUNION', 'VISITA',
  'COTIZACION', 'PROPUESTA', 'NOTA', 'OTRO'
);

create type meeting_type as enum ('PRESENCIAL', 'VIDEOLLAMADA', 'TELEFONICA', 'FERIA');

create type meeting_status as enum (
  'PLANIFICADA', 'CONFIRMADA', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA'
);

create type follow_up_status as enum ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'VENCIDO', 'CANCELADO');

-- ---------- Ventas ----------------------------------------------------
create type sale_status as enum (
  'BORRADOR', 'COTIZACION', 'COMPROMETIDA', 'CONFIRMADA',
  'EN_PRODUCCION', 'PARCIALMENTE_ENTREGADA', 'ENTREGADA',
  'CERRADA', 'ANULADA'
);

create type sale_item_type as enum (
  'CANCHA_NUEVA', 'CANCHA_USADA', 'ILUMINACION', 'CESPED', 'ACCESORIOS',
  'TRANSPORTE', 'INSTALACION', 'SERVICIO', 'REPUESTOS', 'OTRO'
);

create type cost_status as enum ('ESTIMADO', 'COMPROMETIDO', 'DEVENGADO', 'PAGADO', 'ANULADO');

-- ---------- Fabricacion / Canchas ------------------------------------
create type manufacturing_status as enum (
  'PLANIFICACION', 'MATERIALES', 'EN_CONSTRUCCION', 'GALVANIZADO',
  'CONTROL_CALIDAD', 'EMBALAJE', 'LISTO_DESPACHO', 'DESPACHADO',
  'TERMINADO', 'CANCELADO'
);

-- Estados unificados: canchas NUEVAS (EUROPA / ATILA) y USADAS.
-- Se controla por constraint que el estado pertenezca al set valido
-- segun court_type (ver 010_manufacturing_courts.sql).
create type court_status as enum (
  -- nuevas
  'PLANIFICADA', 'MATERIALES_PENDIENTES', 'EN_CONSTRUCCION',
  'CONSTRUCCION_TERMINADA', 'GALVANIZADO', 'GALVANIZADO_TERMINADO',
  'EMBALAJE', 'EMBALADA',
  -- usadas
  'DISPONIBLE', 'RESERVADA', 'EN_DESMONTAJE', 'DESMONTADA',
  'EN_REPARACION', 'PREPARADA', 'EN_TRANSPORTE', 'VENDIDA',
  -- comunes
  'EN_TRANSITO', 'EN_INSTALACION', 'INSTALACION_TERMINADA', 'ENTREGADA',
  'BAJA'
);

create type court_kind as enum ('NUEVA', 'USADA');

create type physical_condition as enum ('NUEVA', 'EXCELENTE', 'BUENA', 'REGULAR', 'MALA');

-- ---------- Compras / Proveedores ------------------------------------
create type supplier_status as enum ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'EVALUACION');

create type quote_status as enum ('SOLICITADA', 'RECIBIDA', 'EN_EVALUACION', 'ACEPTADA', 'RECHAZADA', 'VENCIDA');

create type purchase_order_status as enum (
  'BORRADOR', 'EMITIDA', 'APROBADA', 'RECIBIDA', 'FACTURADA', 'PAGADA', 'ANULADA'
);

-- ---------- Finanzas --------------------------------------------------
create type invoice_kind as enum ('VENTA', 'COMPRA');

create type invoice_status as enum (
  'BORRADOR', 'EMITIDA', 'ENVIADA', 'PARCIALMENTE_PAGADA', 'PAGADA',
  'VENCIDA', 'ANULADA'
);

create type payment_direction as enum ('ENTRADA', 'SALIDA');

create type payment_method as enum (
  'TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CHEQUE', 'CONFIRMING',
  'CARTA_CREDITO', 'OTRO'
);

create type contract_status as enum (
  'BORRADOR', 'EN_REVISION', 'FIRMADO', 'VIGENTE', 'CUMPLIDO',
  'VENCIDO', 'RESCINDIDO'
);

create type bank_transaction_type as enum ('INGRESO', 'EGRESO', 'TRANSFERENCIA');

create type expense_status as enum ('BORRADOR', 'APROBADO', 'PAGADO', 'RECHAZADO');

-- ---------- Logistica -------------------------------------------------
create type shipment_status as enum (
  'PLANIFICADO', 'RESERVADO', 'CARGADO', 'EN_TRANSITO',
  'EN_ADUANA', 'LIBERADO', 'ENTREGADO', 'INCIDENCIA', 'CANCELADO'
);

create type customs_status as enum (
  'NO_APLICA', 'PENDIENTE', 'EN_TRAMITE', 'RETENIDO', 'LIBERADO'
);

create type transport_mode as enum ('MARITIMO', 'TERRESTRE', 'AEREO', 'MULTIMODAL');

-- ---------- Instalaciones / Calidad ----------------------------------
create type installation_status as enum (
  'PLANIFICADA', 'CONFIRMADA', 'EN_CURSO', 'PAUSADA',
  'TERMINADA', 'RECEPCIONADA', 'CANCELADA'
);

create type quality_result as enum ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CORREGIR');

-- ---------- Documentos ------------------------------------------------
create type document_status as enum (
  'BORRADOR', 'EN_REVISION', 'CORRECCION', 'APROBADO', 'RECHAZADO', 'VIGENTE', 'OBSOLETO'
);

create type ai_extraction_status as enum (
  'PENDIENTE', 'PROCESANDO', 'EXTRAIDO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'ERROR'
);

create type approval_status as enum ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO');

-- ---------- Operacion / Alertas --------------------------------------
create type task_status as enum ('PENDIENTE', 'EN_CURSO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA');

create type alert_type as enum (
  'FABRICACION_ATRASADA', 'MATERIAL_FALTANTE', 'SEGUIMIENTO_VENCIDO',
  'COTIZACION_SIN_RESPUESTA', 'INSTALACION_PROXIMA', 'DESPACHO_PROXIMO',
  'FACTURA_VENCIDA', 'CONTRATO_POR_VENCER', 'COSTO_EXCEDIDO',
  'VENTA_SIN_FABRICACION', 'MARGEN_BAJO', 'ENTREGA_ATRASADA'
);

create type alert_status as enum ('ABIERTA', 'RECONOCIDA', 'EN_GESTION', 'RESUELTA', 'DESCARTADA');

create type audit_action as enum (
  'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'UPLOAD',
  'APPROVE', 'REJECT', 'LOGIN', 'EXPORT'
);
