import { z } from 'zod';

/**
 * Esquemas documentales, bancarios y de IA.
 *
 * Espejo de los constraints de `016_documents.sql`, `013_finance.sql` y
 * `026_reconciliation_ai.sql`. Zod da el mensaje util en pantalla;
 * PostgreSQL sigue siendo quien garantiza que el dato no entra mal por
 * ninguna otra via.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida').optional();

export const BUCKET_VALUES = [
  'documents', 'photos', 'designs', 'quotes', 'invoices', 'contracts',
] as const;

export const DOCUMENT_STATUSES = [
  'BORRADOR', 'EN_REVISION', 'CORRECCION', 'APROBADO', 'RECHAZADO', 'VIGENTE', 'OBSOLETO',
] as const;

/** Entidades a las que se puede colgar un documento (enum `entity_type`). */
export const DOCUMENT_ENTITY_TYPES = [
  'CLIENT', 'OPPORTUNITY', 'SALE', 'CONTRACT', 'COURT', 'MANUFACTURING_PROJECT',
  'SUPPLIER', 'PURCHASE_ORDER', 'INVOICE', 'PAYMENT', 'EXPENSE',
  'SHIPMENT', 'INSTALLATION', 'QUALITY_CHECK', 'DOCUMENT',
] as const;

/**
 * Alta de documento.
 *
 * `bucket` y `storage_path` no los teclea nadie: los fija el servidor al
 * firmar el ticket de subida, siguiendo la convencion de ruta. Aqui solo
 * viajan porque el navegador acaba de subir el fichero a esa ruta exacta.
 */
export const DocumentSchema = z.object({
  document_type_id: z.string().uuid('Elige el tipo de documento'),
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(200),
  description: optionalText(1000),
  bucket: z.enum(BUCKET_VALUES),
  storage_path: z.string().trim().min(5).max(500),
  mime_type: optionalText(120),
  file_size: z.coerce.number().int().min(0).optional(),
  file_hash: optionalText(128),
  status: z.enum(DOCUMENT_STATUSES).default('VIGENTE'),
  is_confidential: z.boolean().default(false),
  valid_from: isoDate,
  valid_until: isoDate,
}).refine(
  (v) => !v.valid_from || !v.valid_until || v.valid_until >= v.valid_from,
  { message: 'La fecha de fin de vigencia no puede ser anterior al inicio', path: ['valid_until'] },
);

export const DocumentLinkSchema = z.object({
  document_id: z.string().uuid(),
  entity_type: z.enum(DOCUMENT_ENTITY_TYPES),
  entity_id: z.string().uuid('Selecciona el registro al que se asocia'),
  relation: optionalText(40),
});

// ---------------------------------------------------------------------
// Importacion de extractos bancarios (FASE 9b)
// ---------------------------------------------------------------------

/**
 * Correspondencia entre las columnas del fichero del banco y las de
 * `bank_transactions`.
 *
 * Cada banco exporta con cabeceras distintas, asi que el mapeo es un dato
 * de entrada, no una constante del codigo. `date` y `amount` son
 * obligatorias: sin ellas no hay movimiento que conciliar.
 */
export const BankImportMappingSchema = z.object({
  date: z.string().trim().min(1, 'Indica la columna de fecha'),
  amount: z.string().trim().min(1, 'Indica la columna de importe'),
  /** Algunos bancos exportan debe y haber en dos columnas separadas. */
  credit: optionalText(120),
  debit: optionalText(120),
  description: optionalText(120),
  counterparty: optionalText(120),
  reference: optionalText(120),
  value_date: optionalText(120),
  balance_after: optionalText(120),
});

export type BankImportMapping = z.infer<typeof BankImportMappingSchema>;

export const BankImportSchema = z.object({
  bank_account_id: z.string().uuid('Elige la cuenta bancaria'),
  /** Formato de importe: europeo (1.234,56) o anglosajon (1,234.56). */
  decimal: z.enum(['COMMA', 'DOT']).default('COMMA'),
  /** Orden de la fecha en el fichero. */
  date_order: z.enum(['DMY', 'MDY', 'YMD']).default('DMY'),
  /** Invierte el signo cuando el banco exporta los cargos en positivo. */
  invert_sign: z.boolean().default(false),
});

// ---------------------------------------------------------------------
// IA (FASE 14)
// ---------------------------------------------------------------------
export const EXTRACTION_TYPES = ['INVOICE', 'BL', 'CONTRACT', 'QUOTE'] as const;

export const ExtractionReviewSchema = z.object({
  extraction_id: z.string().uuid(),
  decision: z.enum(['APROBAR', 'RECHAZAR']),
  comment: optionalText(1000),
});

/**
 * Lo que una persona confirma tras revisar una extraccion de factura.
 *
 * Deliberadamente NO es el JSON del modelo: son los campos ya corregidos
 * en pantalla. Lo que se escribe en el negocio es esto, no la salida
 * cruda de la IA (§42).
 */
export const InvoiceExtractionApplySchema = z.object({
  extraction_id: z.string().uuid(),
  kind: z.enum(['VENTA', 'COMPRA']),
  external_number: z.string().trim().min(1, 'El numero de la factura es obligatorio').max(50),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de factura invalida'),
  due_date: isoDate,
  currency: z.enum(['EUR', 'USD', 'ARS', 'CLP']).default('EUR'),
  subtotal: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  client_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  sale_id: z.string().uuid().optional(),
  notes: optionalText(2000),
}).refine((v) => (v.kind === 'VENTA' ? Boolean(v.client_id) : Boolean(v.supplier_id)), {
  message: 'Una factura de venta necesita cliente; una de compra, proveedor',
  path: ['client_id'],
});
