import { z } from 'zod';

/**
 * Esquemas financieros.
 *
 * Los importes son SIEMPRE numeros: nunca texto con simbolo de moneda
 * (§85). Los totales de factura y orden de compra NO se envian desde el
 * formulario: los calcula un trigger a partir de las lineas, de modo que
 * cabecera y detalle no pueden desincronizarse.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida').optional();
const requiredDate = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

export const CURRENCIES = ['EUR', 'USD', 'ARS', 'CLP'] as const;
export const INVOICE_KINDS = ['VENTA', 'COMPRA'] as const;
export const INVOICE_STATUSES = [
  'BORRADOR', 'EMITIDA', 'ENVIADA', 'PARCIALMENTE_PAGADA', 'PAGADA', 'VENCIDA', 'ANULADA',
] as const;
export const PAYMENT_DIRECTIONS = ['ENTRADA', 'SALIDA'] as const;
export const PAYMENT_METHODS = [
  'TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CHEQUE', 'CONFIRMING', 'CARTA_CREDITO', 'OTRO',
] as const;
export const CONTRACT_STATUSES = [
  'BORRADOR', 'EN_REVISION', 'FIRMADO', 'VIGENTE', 'CUMPLIDO', 'VENCIDO', 'RESCINDIDO',
] as const;
export const EXPENSE_STATUSES = ['BORRADOR', 'APROBADO', 'PAGADO', 'RECHAZADO'] as const;

// ---------------------------------------------------------------------
// Facturas
// ---------------------------------------------------------------------
export const InvoiceSchema = z
  .object({
    kind: z.enum(INVOICE_KINDS),
    // Si se deja vacio lo genera el trigger (FV-EUROPA-2026-0001).
    invoice_number: optionalText(50),
    external_number: optionalText(50),
    invoice_date: requiredDate('La fecha de factura es obligatoria'),
    due_date: isoDate,
    status: z.enum(INVOICE_STATUSES).default('BORRADOR'),
    currency: z.enum(CURRENCIES).default('EUR'),
    tax_rate: z.coerce.number().min(0).max(100, 'El IVA va de 0 a 100').default(0),
    client_id: z.string().uuid().optional(),
    sale_id: z.string().uuid().optional(),
    contract_id: z.string().uuid().optional(),
    supplier_id: z.string().uuid().optional(),
    purchase_order_id: z.string().uuid().optional(),
    notes: optionalText(2000),
  })
  // Espejo de `invoices_party_ck`: una factura de venta lleva cliente y no
  // proveedor; una de compra, al reves. Nunca ambigua.
  .refine((v) => (v.kind === 'VENTA' ? Boolean(v.client_id) : true), {
    message: 'Una factura de venta necesita un cliente',
    path: ['client_id'],
  })
  .refine((v) => (v.kind === 'COMPRA' ? Boolean(v.supplier_id) : true), {
    message: 'Una factura de compra necesita un proveedor',
    path: ['supplier_id'],
  })
  .refine((v) => (v.kind === 'VENTA' ? !v.supplier_id : !v.client_id), {
    message: 'Una factura no puede tener cliente y proveedor a la vez',
    path: ['kind'],
  })
  .refine((v) => !v.due_date || v.due_date >= v.invoice_date, {
    message: 'El vencimiento no puede ser anterior a la fecha de factura',
    path: ['due_date'],
  });

export const InvoiceItemSchema = z.object({
  description: z.string().trim().min(2, 'Describe el concepto').max(300),
  quantity: z.coerce.number().gt(0, 'La cantidad debe ser mayor que cero').default(1),
  unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo').default(0),
  discount: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
  cost_category_id: z.string().uuid().optional(),
  sale_item_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------
export const PaymentSchema = z
  .object({
    direction: z.enum(PAYMENT_DIRECTIONS),
    payment_date: requiredDate('La fecha del pago es obligatoria'),
    amount: z.coerce.number().gt(0, 'El importe debe ser mayor que cero'),
    currency: z.enum(CURRENCIES).default('EUR'),
    method: z.enum(PAYMENT_METHODS).default('TRANSFERENCIA'),
    reference: optionalText(200),
    invoice_id: z.string().uuid().optional(),
    sale_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    supplier_id: z.string().uuid().optional(),
    bank_account_id: z.string().uuid().optional(),
    notes: optionalText(1000),
  })
  .refine((v) => (v.direction === 'ENTRADA' ? !v.supplier_id : !v.client_id), {
    message: 'Un cobro se asocia a un cliente y un pago a un proveedor',
    path: ['direction'],
  });

// ---------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------
export const ContractSchema = z
  .object({
    // A diferencia de facturas y ventas, el numero de contrato NO se genera
    // solo: lo fija la empresa.
    contract_number: z.string().trim().min(2, 'El numero de contrato es obligatorio').max(50),
    title: z.string().trim().min(3, 'El titulo es obligatorio').max(200),
    client_id: z.string().uuid().optional(),
    sale_id: z.string().uuid().optional(),
    contract_date: requiredDate('La fecha del contrato es obligatoria'),
    start_date: isoDate,
    end_date: isoDate,
    amount: z.coerce.number().min(0, 'El importe no puede ser negativo').default(0),
    currency: z.enum(CURRENCIES).default('EUR'),
    payment_terms: optionalText(500),
    warranty_terms: optionalText(500),
    penalty_terms: optionalText(500),
    status: z.enum(CONTRACT_STATUSES).default('BORRADOR'),
    signed_by_client: optionalText(200),
    notes: optionalText(2000),
  })
  .refine((v) => !v.end_date || !v.start_date || v.end_date >= v.start_date, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['end_date'],
  });

// ---------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------
export const ExpenseSchema = z.object({
  description: z.string().trim().min(3, 'Describe el gasto').max(300),
  expense_date: requiredDate('La fecha del gasto es obligatoria'),
  amount: z.coerce.number().min(0, 'El importe no puede ser negativo'),
  currency: z.enum(CURRENCIES).default('EUR'),
  status: z.enum(EXPENSE_STATUSES).default('BORRADOR'),
  cost_category_id: z.string().uuid().optional(),
  sale_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  bank_account_id: z.string().uuid().optional(),
  paid_at: isoDate,
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------
// Cuentas bancarias
// ---------------------------------------------------------------------
export const BankAccountSchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la cuenta es obligatorio').max(100),
  bank_name: optionalText(100),
  account_number: optionalText(50),
  iban: optionalText(50),
  swift: optionalText(20),
  currency: z.enum(CURRENCIES).default('EUR'),
  opening_balance: z.coerce.number().default(0),
  active: z.boolean().default(true),
  notes: optionalText(1000),
});
