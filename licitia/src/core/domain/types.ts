// ============================================================================
// Tipos de dominio — espejo del esquema PostgreSQL (0001_schema.sql)
// ============================================================================

export type UserRole = "admin" | "supervisor" | "usuario";

export type DocumentType =
  | "licitacion"
  | "bases_administrativas"
  | "bases_tecnicas"
  | "propuesta_comercial"
  | "propuesta_tecnica"
  | "carta_gantt"
  | "contrato"
  | "anexo"
  | "reclamo"
  | "informe"
  | "acta"
  | "avance"
  | "control_entregas"
  | "otro";

export type DocumentStatus = "subido" | "procesando" | "procesado" | "error" | "archivado";

export type RequirementStatus =
  | "cumplido"
  | "parcial"
  | "pendiente"
  | "no_aplica"
  | "fuera_de_alcance"
  | "adicional";

export type RiskLevel = "bajo" | "medio" | "alto" | "critico";

export type MilestoneType =
  | "inicio"
  | "hito"
  | "capacitacion"
  | "implementacion"
  | "marcha_blanca"
  | "recepcion"
  | "garantia"
  | "soporte"
  | "termino"
  | "entregable"
  | "otro";

export type VariableCategory =
  | "sistema" | "modulo" | "funcionalidad" | "integracion" | "api" | "reporte"
  | "dashboard" | "interfaz" | "servicio_web" | "base_datos" | "infraestructura"
  | "seguridad" | "backup" | "migracion" | "capacitacion" | "implementacion"
  | "mesa_ayuda" | "soporte" | "sla" | "hardware" | "software" | "licencia"
  | "multa" | "garantia" | "certificacion" | "personal" | "experiencia" | "otro";

export type AgentKind = "analista" | "comparador" | "reclamos" | "propuestas" | "comercial";

export interface Profile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface DocumentRow {
  id: string;
  organization_id: string;
  client_id: string | null;
  title: string;
  doc_type: DocumentType;
  status: DocumentStatus;
  processing_step: string | null;
  processing_error: string | null;
  tender_number: string | null;
  tender_name: string | null;
  market_id: string | null;
  provider: string | null;
  area: string | null;
  project_type: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  doc_date: string | null;
  amount: number | null;
  currency: string | null;
  contract_duration: string | null;
  language: string | null;
  doc_state: string | null;
  page_count: number | null;
  is_scanned: boolean;
  classification: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageText {
  pageNumber: number;
  content: string;
  ocrUsed: boolean;
}

export interface ExtractedText {
  pages: PageText[];
  isScanned: boolean;
}

export interface Chunk {
  index: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
  tokenCount: number;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  page: number | null;
  section: string | null;
  quote: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  score: number;
}

export interface SearchFilters {
  documentIds?: string[];
  docType?: DocumentType;
  clientId?: string;
}
