import { z } from 'zod';

/**
 * Esquemas de operaciones y ventas.
 *
 * Los estados de cancha se validan contra el conjunto valido para su tipo,
 * exactamente igual que el constraint `courts_status_domain_ck`: una
 * cancha nueva no puede quedar EN_REPARACION ni una usada GALVANIZADO.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida').optional();
const requiredDate = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

export const CURRENCIES = ['EUR', 'USD', 'ARS', 'CLP'] as const;
export const PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export const SALE_STATUSES = [
  'BORRADOR', 'COTIZACION', 'COMPROMETIDA', 'CONFIRMADA', 'EN_PRODUCCION',
  'PARCIALMENTE_ENTREGADA', 'ENTREGADA', 'CERRADA', 'ANULADA',
] as const;

export const SALE_ITEM_TYPES = [
  'CANCHA_NUEVA', 'CANCHA_USADA', 'ILUMINACION', 'CESPED', 'ACCESORIOS',
  'TRANSPORTE', 'INSTALACION', 'SERVICIO', 'REPUESTOS', 'OTRO',
] as const;

export const COST_STATUSES = ['ESTIMADO', 'COMPROMETIDO', 'DEVENGADO', 'PAGADO', 'ANULADO'] as const;

export const MANUFACTURING_STATUSES = [
  'PLANIFICACION', 'MATERIALES', 'EN_CONSTRUCCION', 'GALVANIZADO', 'CONTROL_CALIDAD',
  'EMBALAJE', 'LISTO_DESPACHO', 'DESPACHADO', 'TERMINADO', 'CANCELADO',
] as const;

export const COURT_STATUSES_NEW = [
  'PLANIFICADA', 'MATERIALES_PENDIENTES', 'EN_CONSTRUCCION', 'CONSTRUCCION_TERMINADA',
  'GALVANIZADO', 'GALVANIZADO_TERMINADO', 'EMBALAJE', 'EMBALADA', 'EN_TRANSITO',
  'EN_INSTALACION', 'INSTALACION_TERMINADA', 'ENTREGADA', 'BAJA',
] as const;

export const COURT_STATUSES_USED = [
  'DISPONIBLE', 'RESERVADA', 'EN_DESMONTAJE', 'DESMONTADA', 'EN_REPARACION', 'PREPARADA',
  'EN_TRANSPORTE', 'EN_TRANSITO', 'EN_INSTALACION', 'INSTALACION_TERMINADA',
  'ENTREGADA', 'VENDIDA', 'BAJA',
] as const;

export const PHYSICAL_CONDITIONS = ['NUEVA', 'EXCELENTE', 'BUENA', 'REGULAR', 'MALA'] as const;
export const SUPPLIER_STATUSES = ['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'EVALUACION'] as const;
export const PO_STATUSES = [
  'BORRADOR', 'EMITIDA', 'APROBADA', 'RECIBIDA', 'FACTURADA', 'PAGADA', 'ANULADA',
] as const;
export const SHIPMENT_STATUSES = [
  'PLANIFICADO', 'RESERVADO', 'CARGADO', 'EN_TRANSITO', 'EN_ADUANA', 'LIBERADO',
  'ENTREGADO', 'INCIDENCIA', 'CANCELADO',
] as const;
export const CUSTOMS_STATUSES = ['NO_APLICA', 'PENDIENTE', 'EN_TRAMITE', 'RETENIDO', 'LIBERADO'] as const;
export const TRANSPORT_MODES = ['MARITIMO', 'TERRESTRE', 'AEREO', 'MULTIMODAL'] as const;
export const INSTALLATION_STATUSES = [
  'PLANIFICADA', 'CONFIRMADA', 'EN_CURSO', 'PAUSADA', 'TERMINADA', 'RECEPCIONADA', 'CANCELADA',
] as const;
export const QUALITY_RESULTS = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'CORREGIR'] as const;

// ---------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------
export const SaleSchema = z.object({
  client_id: z.string().uuid('Selecciona un cliente'),
  opportunity_id: z.string().uuid().optional(),
  // Si se deja vacio lo genera el trigger (EUROPA-2026-0014).
  sale_number: optionalText(50),
  sale_date: requiredDate('La fecha de venta es obligatoria'),
  status: z.enum(SALE_STATUSES).default('BORRADOR'),
  currency: z.enum(CURRENCIES).default('EUR'),
  tax_rate: z.coerce.number().min(0).max(100, 'El IVA va de 0 a 100').default(0),
  delivery_date: isoDate,
  payment_terms: optionalText(300),
  incoterm: optionalText(20),
  delivery_address: optionalText(300),
  delivery_country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
  delivery_city: optionalText(100),
  notes: optionalText(2000),
});

export const SaleItemSchema = z
  .object({
    product_type: z.enum(SALE_ITEM_TYPES),
    description: z.string().trim().min(2, 'Describe el concepto').max(300),
    model: optionalText(100),
    quantity: z.coerce.number().gt(0, 'La cantidad debe ser mayor que cero').default(1),
    unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo').default(0),
    discount: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
    estimated_unit_cost: z.coerce.number().min(0, 'El costo no puede ser negativo').default(0),
    sort_order: z.coerce.number().int().default(100),
  })
  // Espejo de `sale_items_discount_ck`.
  .refine((v) => v.discount <= v.quantity * v.unit_price, {
    message: 'El descuento no puede superar el importe de la linea',
    path: ['discount'],
  });

export const SaleCostSchema = z.object({
  cost_category_id: z.string().uuid('Selecciona una categoria de costo'),
  description: optionalText(300),
  estimated_amount: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  actual_amount: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  currency: z.enum(CURRENCIES).default('EUR'),
  status: z.enum(COST_STATUSES).default('ESTIMADO'),
  supplier_id: z.string().uuid().optional(),
  court_id: z.string().uuid().optional(),
  cost_date: isoDate,
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------
// Fabricacion y canchas
// ---------------------------------------------------------------------
export const ManufacturingProjectSchema = z
  .object({
    name: z.string().trim().min(3, 'El nombre es obligatorio').max(200),
    description: optionalText(2000),
    sale_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    quantity_courts: z.coerce.number().int().min(0, 'No puede ser negativo').default(0),
    start_date: isoDate,
    estimated_completion_date: isoDate,
    actual_completion_date: isoDate,
    status: z.enum(MANUFACTURING_STATUSES).default('PLANIFICACION'),
    priority: z.enum(PRIORITIES).default('MEDIA'),
    notes: optionalText(2000),
  })
  .refine(
    (v) => !v.start_date || !v.estimated_completion_date || v.estimated_completion_date >= v.start_date,
    { message: 'La fecha estimada no puede ser anterior al inicio', path: ['estimated_completion_date'] },
  );

/**
 * El estado admitido depende del tipo de cancha. Se valida aqui para dar
 * un mensaje claro antes de que el CHECK de PostgreSQL rechace la fila.
 */
export const CourtSchema = z
  .object({
    court_number: optionalText(50),
    serial_number: optionalText(50),
    model: optionalText(100),
    court_type: z.enum(['NUEVA', 'USADA']).default('NUEVA'),
    year: z.coerce.number().int().min(1980).max(2100).optional(),
    status: z.string(),
    sale_id: z.string().uuid().optional(),
    manufacturing_project_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    current_location: optionalText(200),
    country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
    city: optionalText(100),
    purchase_cost: z.coerce.number().min(0).optional(),
    refurbishment_cost: z.coerce.number().min(0).optional(),
    sale_price: z.coerce.number().min(0).optional(),
    currency: z.enum(CURRENCIES).default('EUR'),
    physical_condition: z.enum(PHYSICAL_CONDITIONS).optional(),
    dimensions: optionalText(100),
    glass_thickness_mm: z.coerce.number().int().min(0).optional(),
    has_lighting: z.boolean().default(false),
    notes: optionalText(2000),
  })
  .refine(
    (v) =>
      v.court_type === 'NUEVA'
        ? (COURT_STATUSES_NEW as readonly string[]).includes(v.status)
        : (COURT_STATUSES_USED as readonly string[]).includes(v.status),
    { message: 'Ese estado no es valido para este tipo de cancha', path: ['status'] },
  );

export const MaterialRequirementSchema = z.object({
  manufacturing_project_id: z.string().uuid('Selecciona el proyecto de fabricacion'),
  material_id: z.string().uuid('Selecciona un material'),
  sale_id: z.string().uuid().optional(),
  court_id: z.string().uuid().optional(),
  quantity_required: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  quantity_available: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  quantity_purchased: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  needed_by_date: isoDate,
  estimated_unit_cost: z.coerce.number().min(0).default(0),
  currency: z.enum(CURRENCIES).default('EUR'),
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------
// Proveedores y compras
// ---------------------------------------------------------------------
export const SupplierSchema = z.object({
  company_name: z.string().trim().min(2, 'El nombre del proveedor es obligatorio').max(200),
  tax_id: optionalText(50),
  country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
  city: optionalText(100),
  address: optionalText(300),
  contact_name: optionalText(100),
  email: z.string().trim().email('Email no valido').optional().or(z.literal(undefined)),
  phone: optionalText(50),
  category: optionalText(50),
  currency: z.enum(CURRENCIES).default('EUR'),
  payment_terms: optionalText(200),
  rating: z.coerce.number().int().min(1, 'De 1 a 5').max(5, 'De 1 a 5').optional(),
  status: z.enum(SUPPLIER_STATUSES).default('ACTIVO'),
  notes: optionalText(2000),
});

export const PurchaseOrderSchema = z
  .object({
    supplier_id: z.string().uuid('Selecciona un proveedor'),
    po_number: optionalText(50),
    manufacturing_project_id: z.string().uuid().optional(),
    sale_id: z.string().uuid().optional(),
    order_date: requiredDate('La fecha de la orden es obligatoria'),
    expected_delivery_date: isoDate,
    actual_delivery_date: isoDate,
    status: z.enum(PO_STATUSES).default('BORRADOR'),
    currency: z.enum(CURRENCIES).default('EUR'),
    tax_rate: z.coerce.number().min(0).max(100, 'El IVA va de 0 a 100').default(0),
    delivery_address: optionalText(300),
    payment_terms: optionalText(200),
    notes: optionalText(2000),
  })
  .refine(
    (v) => !v.expected_delivery_date || v.expected_delivery_date >= v.order_date,
    { message: 'La entrega prevista no puede ser anterior a la orden', path: ['expected_delivery_date'] },
  );

export const PurchaseOrderItemSchema = z
  .object({
    description: z.string().trim().min(2, 'Describe el concepto').max(300),
    material_id: z.string().uuid().optional(),
    cost_category_id: z.string().uuid().optional(),
    quantity: z.coerce.number().gt(0, 'La cantidad debe ser mayor que cero').default(1),
    unit: z.string().trim().max(10).default('UN'),
    unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo').default(0),
    quantity_received: z.coerce.number().min(0, 'No puede ser negativo').default(0),
  })
  .refine((v) => v.quantity_received <= v.quantity, {
    message: 'Lo recibido no puede superar lo pedido',
    path: ['quantity_received'],
  });

// ---------------------------------------------------------------------
// Logistica
// ---------------------------------------------------------------------
export const ShipmentSchema = z
  .object({
    shipment_number: optionalText(50),
    sale_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    transport_mode: z.enum(TRANSPORT_MODES).default('MARITIMO'),
    origin: optionalText(200),
    origin_country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
    destination: optionalText(200),
    destination_country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
    carrier: optionalText(100),
    forwarder: optionalText(100),
    container_number: optionalText(50),
    container_type: optionalText(20),
    booking_number: optionalText(50),
    bl_number: optionalText(50),
    incoterm: optionalText(20),
    departure_date: isoDate,
    estimated_arrival: isoDate,
    actual_arrival: isoDate,
    customs_status: z.enum(CUSTOMS_STATUSES).default('NO_APLICA'),
    customs_cleared_at: isoDate,
    status: z.enum(SHIPMENT_STATUSES).default('PLANIFICADO'),
    freight_cost: z.coerce.number().min(0).optional(),
    insurance_cost: z.coerce.number().min(0).optional(),
    customs_cost: z.coerce.number().min(0).optional(),
    currency: z.enum(CURRENCIES).default('EUR'),
    notes: optionalText(2000),
  })
  .refine(
    (v) => !v.estimated_arrival || !v.departure_date || v.estimated_arrival >= v.departure_date,
    { message: 'La llegada estimada no puede ser anterior a la salida', path: ['estimated_arrival'] },
  );

// ---------------------------------------------------------------------
// Instalaciones y calidad
// ---------------------------------------------------------------------
export const InstallationSchema = z
  .object({
    installation_number: optionalText(50),
    name: optionalText(200),
    sale_id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    shipment_id: z.string().uuid().optional(),
    address: optionalText(300),
    city: optionalText(100),
    country: z.string().trim().toUpperCase().length(2, 'Codigo ISO de 2 letras').optional(),
    postal_code: optionalText(20),
    planned_start_date: isoDate,
    planned_end_date: isoDate,
    actual_start_date: isoDate,
    actual_end_date: isoDate,
    status: z.enum(INSTALLATION_STATUSES).default('PLANIFICADA'),
    received_by_name: optionalText(200),
    client_observations: optionalText(2000),
    notes: optionalText(2000),
  })
  .refine(
    (v) => !v.planned_end_date || !v.planned_start_date || v.planned_end_date >= v.planned_start_date,
    { message: 'El fin previsto no puede ser anterior al inicio', path: ['planned_end_date'] },
  );

export const QualityCheckSchema = z
  .object({
    check_type: z.string().trim().min(2).max(50).default('FABRICACION'),
    check_date: requiredDate('La fecha del control es obligatoria'),
    manufacturing_project_id: z.string().uuid().optional(),
    court_id: z.string().uuid().optional(),
    installation_id: z.string().uuid().optional(),
    result: z.enum(QUALITY_RESULTS).default('PENDIENTE'),
    score: z.coerce.number().int().min(0, 'De 0 a 100').max(100, 'De 0 a 100').optional(),
    observations: optionalText(2000),
    corrective_actions: optionalText(2000),
  })
  // Espejo de `quality_checks_target_ck`.
  .refine((v) => Boolean(v.manufacturing_project_id || v.court_id || v.installation_id), {
    message: 'Indica sobre que se hace el control: fabricacion, cancha o instalacion',
    path: ['court_id'],
  });
