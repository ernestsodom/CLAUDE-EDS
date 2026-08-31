/**
 * Tipos del dominio.
 *
 * En un proyecto Supabase real estos tipos se regeneran con:
 *   npm run types:gen        (supabase gen types typescript --local)
 *
 * Este archivo mantiene a mano el subconjunto que la aplicacion consume,
 * de forma que el codigo compila y tiene tipado estricto aun sin haber
 * ejecutado el generador.
 */

// ---------------------------------------------------------------------
// Enums (espejo de 002_enums.sql)
// ---------------------------------------------------------------------
export type CurrencyCode = 'EUR' | 'USD' | 'ARS' | 'CLP';
export type PriorityLevel = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type ClientStatus =
  | 'PROSPECTO' | 'CONTACTADO' | 'CALIFICADO' | 'ACTIVO' | 'INACTIVO' | 'PERDIDO';

export type OpportunityStatus =
  | 'NUEVA' | 'CALIFICANDO' | 'REUNION' | 'COTIZADA'
  | 'NEGOCIACION' | 'GANADA' | 'PERDIDA' | 'ARCHIVADA';

export type SaleStatus =
  | 'BORRADOR' | 'COTIZACION' | 'COMPROMETIDA' | 'CONFIRMADA'
  | 'EN_PRODUCCION' | 'PARCIALMENTE_ENTREGADA' | 'ENTREGADA'
  | 'CERRADA' | 'ANULADA';

export type SaleItemType =
  | 'CANCHA_NUEVA' | 'CANCHA_USADA' | 'ILUMINACION' | 'CESPED' | 'ACCESORIOS'
  | 'TRANSPORTE' | 'INSTALACION' | 'SERVICIO' | 'REPUESTOS' | 'OTRO';

export type CourtStatus =
  | 'PLANIFICADA' | 'MATERIALES_PENDIENTES' | 'EN_CONSTRUCCION'
  | 'CONSTRUCCION_TERMINADA' | 'GALVANIZADO' | 'GALVANIZADO_TERMINADO'
  | 'EMBALAJE' | 'EMBALADA'
  | 'DISPONIBLE' | 'RESERVADA' | 'EN_DESMONTAJE' | 'DESMONTADA'
  | 'EN_REPARACION' | 'PREPARADA' | 'EN_TRANSPORTE' | 'VENDIDA'
  | 'EN_TRANSITO' | 'EN_INSTALACION' | 'INSTALACION_TERMINADA' | 'ENTREGADA'
  | 'BAJA';

export type CourtKind = 'NUEVA' | 'USADA';

export type ManufacturingStatus =
  | 'PLANIFICACION' | 'MATERIALES' | 'EN_CONSTRUCCION' | 'GALVANIZADO'
  | 'CONTROL_CALIDAD' | 'EMBALAJE' | 'LISTO_DESPACHO' | 'DESPACHADO'
  | 'TERMINADO' | 'CANCELADO';

export type InvoiceKind = 'VENTA' | 'COMPRA';
export type InvoiceStatus =
  | 'BORRADOR' | 'EMITIDA' | 'ENVIADA' | 'PARCIALMENTE_PAGADA'
  | 'PAGADA' | 'VENCIDA' | 'ANULADA';

export type ShipmentStatus =
  | 'PLANIFICADO' | 'RESERVADO' | 'CARGADO' | 'EN_TRANSITO'
  | 'EN_ADUANA' | 'LIBERADO' | 'ENTREGADO' | 'INCIDENCIA' | 'CANCELADO';

export type InstallationStatus =
  | 'PLANIFICADA' | 'CONFIRMADA' | 'EN_CURSO' | 'PAUSADA'
  | 'TERMINADA' | 'RECEPCIONADA' | 'CANCELADA';

export type FollowUpStatus =
  | 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADO' | 'VENCIDO' | 'CANCELADO';

export type TaskStatus =
  | 'PENDIENTE' | 'EN_CURSO' | 'BLOQUEADA' | 'COMPLETADA' | 'CANCELADA';

export type AlertStatus = 'ABIERTA' | 'RECONOCIDA' | 'EN_GESTION' | 'RESUELTA' | 'DESCARTADA';

export type AlertType =
  | 'FABRICACION_ATRASADA' | 'MATERIAL_FALTANTE' | 'SEGUIMIENTO_VENCIDO'
  | 'COTIZACION_SIN_RESPUESTA' | 'INSTALACION_PROXIMA' | 'DESPACHO_PROXIMO'
  | 'FACTURA_VENCIDA' | 'CONTRATO_POR_VENCER' | 'COSTO_EXCEDIDO'
  | 'VENTA_SIN_FABRICACION' | 'MARGEN_BAJO' | 'ENTREGA_ATRASADA';

export type DeliveryState =
  | 'SIN_CANCHAS' | 'PENDIENTE' | 'PARCIALMENTE_ENTREGADA' | 'ENTREGADA';

// ---------------------------------------------------------------------
// Contexto de sesion (RPC get_session_context)
// ---------------------------------------------------------------------
export interface SessionUser {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  is_super_admin: boolean;
  locale: string;
  timezone: string;
}

export interface SessionProject {
  id: string;
  code: string;
  name: string;
  default_currency: CurrencyCode;
  timezone: string;
  court_kind: CourtKind;
  role: string | null;
  modules: string[];
  permissions: string[];
}

export interface SessionContext {
  user: SessionUser | null;
  projects: SessionProject[];
}

// ---------------------------------------------------------------------
// Vistas analiticas
// ---------------------------------------------------------------------
export interface DashboardGlobal {
  project_id: string;
  project_code: string;
  project_name: string;
  currency: CurrencyCode;

  pipeline_amount: number;
  weighted_pipeline: number;
  open_opportunities: number;
  prospects: number;

  committed_sales: number;
  closed_sales: number;

  courts_sold: number;
  courts_in_production: number;
  courts_in_transit: number;
  courts_installing: number;
  courts_delivered: number;
  courts_pending_delivery: number;
  used_courts_available: number;

  total_invoiced_sales: number;
  total_collected: number;
  accounts_receivable: number;
  accounts_payable: number;
  total_expenses: number;
  overdue_receivable: number;

  estimated_cost: number;
  actual_cost: number;
  actual_margin: number;
  actual_margin_pct: number | null;
  projected_margin: number;
  projected_margin_pct: number | null;

  delayed_manufacturing: number;
  overdue_follow_ups: number;
  critical_alerts: number;
  open_alerts: number;
}

export interface SaleFinancials {
  sale_id: string;
  project_id: string;
  project_code: string;
  sale_number: string;
  sale_date: string;
  status: SaleStatus;
  currency: CurrencyCode;
  client_id: string;
  client_name: string;
  client_country: string | null;
  salesperson_id: string | null;
  delivery_date: string | null;

  total_sale: number;
  estimated_cost: number;
  actual_cost: number;
  estimated_margin: number;
  actual_margin: number;
  estimated_margin_percentage: number | null;
  actual_margin_percentage: number | null;
  cost_deviation: number;
  cost_deviation_pct: number | null;

  has_actual_cost: boolean;
  projected_cost: number;
  projected_margin: number;
  projected_margin_percentage: number | null;
  cost_recognition_pct: number | null;

  invoiced_amount: number;
  collected_amount: number;
  pending_to_invoice: number;
  receivable_amount: number;
  collection_percentage: number | null;

  courts_total: number;
  courts_delivered: number;
  courts_in_transit: number;
  courts_in_production: number;
  courts_installing: number;
  courts_pending_delivery: number;

  delivery_state: DeliveryState;
  is_low_margin: boolean | null;
  is_cost_overrun: boolean | null;
}

export interface SaleCostVariance {
  project_id: string;
  sale_id: string;
  cost_group: string;
  category_code: string;
  category_name: string;
  currency: CurrencyCode;
  estimated_amount: number;
  actual_amount: number;
  deviation_amount: number;
  deviation_pct: number | null;
}

export interface ControlCenterAlert {
  id: string;
  project_id: string;
  alert_type: AlertType;
  priority: PriorityLevel;
  status: AlertStatus;
  title: string;
  message: string | null;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  first_detected_at: string;
  last_detected_at: string;
  bucket: 'CRITICO' | 'IMPORTANTE' | 'PROXIMO';
  tasks_count: number;
}

export interface AgendaItem {
  project_id: string;
  kind: string;
  entity_id: string;
  entity_type: string;
  title: string;
  event_date: string | null;
  user_id: string | null;
  status: string;
  priority: PriorityLevel;
}

export interface Client360 {
  client_id: string;
  project_id: string;
  company_name: string;
  status: ClientStatus;
  country: string | null;
  owner_user_id: string | null;
  contacts_count: number;
  opportunities_count: number;
  open_pipeline: number;
  sales_count: number;
  total_sold: number;
  receivable: number;
  courts_count: number;
  last_activity_at: string | null;
  open_follow_ups: number;
  overdue_follow_ups: number;
}

export interface AccountsReceivable {
  invoice_id: string;
  project_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  currency: CurrencyCode;
  total: number;
  paid_amount: number;
  balance: number;
  status: InvoiceStatus;
  client_id: string;
  client_name: string;
  sale_id: string | null;
  sale_number: string | null;
  days_overdue: number | null;
  aging_bucket: string;
}

export interface ManufacturingSummary {
  manufacturing_project_id: string;
  project_id: string;
  sale_id: string | null;
  name: string;
  status: ManufacturingStatus;
  priority: PriorityLevel;
  start_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  responsible_user_id: string | null;
  courts_count: number;
  courts_built: number;
  progress_pct: number | null;
  materials_missing: number;
  is_delayed: boolean;
  days_to_deadline: number | null;
}

export interface UsedCourtInventory {
  project_id: string;
  court_id: string;
  court_number: string;
  serial_number: string | null;
  model: string | null;
  status: CourtStatus;
  physical_condition: string | null;
  current_location: string | null;
  country: string | null;
  currency: CurrencyCode;
  purchase_cost: number;
  refurbishment_cost: number;
  allocated_costs: number;
  total_cost: number;
  sale_price: number;
  margin: number;
  sale_id: string | null;
  client_id: string | null;
}

// ---------------------------------------------------------------------
// Filas de tabla usadas por las fichas de detalle
// ---------------------------------------------------------------------
export interface Court {
  id: string;
  project_id: string;
  sale_id: string | null;
  manufacturing_project_id: string | null;
  client_id: string | null;
  court_number: string;
  serial_number: string | null;
  model: string | null;
  court_type: CourtKind;
  year: number | null;
  status: CourtStatus;
  current_location: string | null;
  country: string | null;
  city: string | null;
  purchase_cost: number | null;
  refurbishment_cost: number | null;
  sale_price: number | null;
  currency: CurrencyCode;
  physical_condition: string | null;
  has_lighting: boolean;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_type: SaleItemType;
  description: string;
  model: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  sort_order: number;
}

export interface ProjectEvent {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
}

export interface CourtStatusHistory {
  id: string;
  court_id: string;
  previous_status: CourtStatus | null;
  new_status: CourtStatus;
  changed_by: string | null;
  changed_at: string;
  comment: string | null;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
}

// ---------------------------------------------------------------------
// Negocios (modulo trader)
// ---------------------------------------------------------------------
export type DealStatus =
  | 'POTENCIAL' | 'EN_NEGOCIACION' | 'CERRADA' | 'ENTREGADA' | 'PERDIDA';

export type LogoBrand = 'ATILA' | 'CLUB';

export interface Deal {
  id: string;
  project_id: string;
  code: string;
  client_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  city: string | null;
  status: DealStatus;
  commission_per_court_usd: number;
  courts_count: number;
  total_commission_usd: number;
  opened_at: string;
  expected_close_date: string | null;
  closed_at: string | null;
  delivery_date: string | null;
  lost_reason: string | null;
  notes: string | null;
}

/** Fila del tablero del trader (vista v_deal_board). */
export interface DealBoardRow {
  deal_id: string;
  code: string;
  client_name: string;
  country: string | null;
  city: string | null;
  status: DealStatus;
  courts_count: number;
  total_commission_usd: number;
  opened_at: string;
  expected_close_date: string | null;
  closed_at: string | null;
  delivery_date: string | null;
  court_mix: string;
  custom_courts: number;
  days_to_delivery: number | null;
}

export interface DealCourt {
  id: string;
  deal_id: string;
  court_model_id: string;
  position: number;
  is_custom: boolean;
  commission_usd: number;
  specs: string | null;
}

export interface CourtModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_commission_usd: number;
  sort_order: number;
  active: boolean;
}

export interface LogoPosition {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface DealCourtLogo {
  id: string;
  deal_court_id: string;
  brand: LogoBrand;
  logo_position_id: string;
}
