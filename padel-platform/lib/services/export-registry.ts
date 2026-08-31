import 'server-only';

import type { ExportColumn } from '@/lib/services/export';

/**
 * Registro de reportes exportables.
 *
 * Es una whitelist deliberada: la ruta de exportación no acepta un
 * nombre de tabla arbitrario del cliente, solo una de estas claves. Cada
 * entrada usa la misma vista o tabla —y por tanto las mismas cifras—
 * que la pantalla equivalente, para que el export y el dashboard nunca
 * puedan discrepar.
 */
export interface ExportDefinition {
  /** Tabla o vista de origen. */
  from: string;
  /** Módulo de permisos: se exige `<module>.export`. */
  module: string;
  columns: ExportColumn[];
  orderBy: { column: string; ascending?: boolean };
  /** Excluye borrados lógicos cuando la fuente los tiene. */
  softDelete?: boolean;
}

export const EXPORTS: Record<string, ExportDefinition> = {
  negocios: {
    from: 'v_deal_board',
    module: 'deals',
    orderBy: { column: 'opened_at', ascending: false },
    columns: [
      { key: 'code', header: 'Codigo' },
      { key: 'client_name', header: 'Club / cliente' },
      { key: 'status', header: 'Estado' },
      { key: 'city', header: 'Ciudad' },
      { key: 'country', header: 'Pais' },
      { key: 'courts_count', header: 'Canchas' },
      { key: 'court_mix', header: 'Tipos de cancha' },
      { key: 'custom_courts', header: 'Personalizadas' },
      { key: 'total_commission_usd', header: 'Comision USD' },
      { key: 'opened_at', header: 'Alta' },
      { key: 'expected_close_date', header: 'Cierre estimado' },
      { key: 'closed_at', header: 'Cierre real' },
      { key: 'delivery_date', header: 'Entrega' },
      { key: 'contact_name', header: 'Contacto' },
      { key: 'contact_email', header: 'Email' },
      { key: 'contact_phone', header: 'Telefono' },
    ],
  },

  ventas: {
    from: 'v_sale_financials',
    module: 'sales',
    orderBy: { column: 'sale_date', ascending: false },
    columns: [
      { key: 'sale_number', header: 'Número' },
      { key: 'sale_date', header: 'Fecha' },
      { key: 'status', header: 'Estado' },
      { key: 'client_name', header: 'Cliente' },
      { key: 'client_country', header: 'País' },
      { key: 'currency', header: 'Moneda' },
      { key: 'total_sale', header: 'Total' },
      { key: 'projected_cost', header: 'Costo proyectado' },
      { key: 'projected_margin', header: 'Margen proyectado' },
      { key: 'projected_margin_percentage', header: 'Margen %' },
      { key: 'invoiced_amount', header: 'Facturado' },
      { key: 'collected_amount', header: 'Cobrado' },
      { key: 'receivable_amount', header: 'Por cobrar' },
      { key: 'courts_total', header: 'Canchas' },
      { key: 'courts_delivered', header: 'Entregadas' },
      { key: 'delivery_state', header: 'Estado de entrega' },
    ],
  },

  oportunidades: {
    from: 'opportunities',
    module: 'opportunities',
    softDelete: true,
    orderBy: { column: 'created_at', ascending: false },
    columns: [
      { key: 'name', header: 'Oportunidad' },
      { key: 'status', header: 'Etapa' },
      { key: 'estimated_courts', header: 'Canchas estimadas' },
      { key: 'estimated_amount', header: 'Importe estimado' },
      { key: 'currency', header: 'Moneda' },
      { key: 'probability', header: 'Probabilidad %' },
      { key: 'source', header: 'Origen' },
      { key: 'expected_close_date', header: 'Cierre esperado' },
      { key: 'next_action', header: 'Próxima acción' },
      { key: 'next_action_date', header: 'Fecha próxima acción' },
    ],
  },

  fabricacion: {
    from: 'v_manufacturing_summary',
    module: 'manufacturing',
    orderBy: { column: 'estimated_completion_date', ascending: true },
    columns: [
      { key: 'name', header: 'Proyecto' },
      { key: 'status', header: 'Estado' },
      { key: 'priority', header: 'Prioridad' },
      { key: 'start_date', header: 'Inicio' },
      { key: 'estimated_completion_date', header: 'Entrega estimada' },
      { key: 'courts_count', header: 'Canchas' },
      { key: 'courts_built', header: 'Construidas' },
      { key: 'progress_pct', header: 'Avance %' },
      { key: 'materials_missing', header: 'Materiales faltantes' },
      { key: 'is_delayed', header: 'Atrasado' },
    ],
  },

  canchas: {
    from: 'v_court_status_summary',
    module: 'courts',
    orderBy: { column: 'court_type', ascending: true },
    columns: [
      { key: 'court_type', header: 'Tipo' },
      { key: 'status', header: 'Estado' },
      { key: 'courts_count', header: 'Cantidad' },
      { key: 'total_sale_value', header: 'Valor de venta' },
      { key: 'total_cost_value', header: 'Valor de costo' },
    ],
  },

  logistica: {
    from: 'shipments',
    module: 'logistics',
    softDelete: true,
    orderBy: { column: 'departure_date', ascending: false },
    columns: [
      { key: 'shipment_number', header: 'Embarque' },
      { key: 'status', header: 'Estado' },
      { key: 'transport_mode', header: 'Transporte' },
      { key: 'origin', header: 'Origen' },
      { key: 'destination', header: 'Destino' },
      { key: 'carrier', header: 'Naviera / transportista' },
      { key: 'container_number', header: 'Contenedor' },
      { key: 'bl_number', header: 'BL' },
      { key: 'departure_date', header: 'Salida' },
      { key: 'estimated_arrival', header: 'ETA' },
      { key: 'actual_arrival', header: 'Llegada real' },
      { key: 'customs_status', header: 'Aduana' },
    ],
  },

  instalaciones: {
    from: 'installations',
    module: 'installations',
    softDelete: true,
    orderBy: { column: 'planned_start_date', ascending: false },
    columns: [
      { key: 'installation_number', header: 'Instalación' },
      { key: 'name', header: 'Nombre' },
      { key: 'status', header: 'Estado' },
      { key: 'city', header: 'Ciudad' },
      { key: 'country', header: 'País' },
      { key: 'planned_start_date', header: 'Inicio planificado' },
      { key: 'planned_end_date', header: 'Fin planificado' },
      { key: 'actual_start_date', header: 'Inicio real' },
      { key: 'actual_end_date', header: 'Fin real' },
      { key: 'received_at', header: 'Recepcionada' },
    ],
  },

  facturas: {
    from: 'v_accounts_receivable',
    module: 'invoices',
    orderBy: { column: 'days_overdue', ascending: false },
    columns: [
      { key: 'invoice_number', header: 'Factura' },
      { key: 'invoice_date', header: 'Fecha' },
      { key: 'due_date', header: 'Vencimiento' },
      { key: 'client_name', header: 'Cliente' },
      { key: 'currency', header: 'Moneda' },
      { key: 'total', header: 'Total' },
      { key: 'paid_amount', header: 'Cobrado' },
      { key: 'balance', header: 'Saldo' },
      { key: 'status', header: 'Estado' },
      { key: 'days_overdue', header: 'Días de mora' },
      { key: 'aging_bucket', header: 'Tramo' },
    ],
  },

  rentabilidad: {
    from: 'v_sale_financials',
    module: 'profitability',
    orderBy: { column: 'sale_date', ascending: false },
    columns: [
      { key: 'sale_number', header: 'Venta' },
      { key: 'client_name', header: 'Cliente' },
      { key: 'total_sale', header: 'Total' },
      { key: 'estimated_cost', header: 'Costo estimado' },
      { key: 'actual_cost', header: 'Costo real' },
      { key: 'estimated_margin', header: 'Margen estimado' },
      { key: 'actual_margin', header: 'Margen real' },
      { key: 'projected_margin_percentage', header: 'Margen proyectado %' },
      { key: 'has_actual_cost', header: 'Con costo real' },
      { key: 'cost_deviation_pct', header: 'Desviación de costo %' },
    ],
  },

  clientes: {
    from: 'v_client_360',
    module: 'clients',
    orderBy: { column: 'total_sold', ascending: false },
    columns: [
      { key: 'company_name', header: 'Cliente' },
      { key: 'country', header: 'País' },
      { key: 'status', header: 'Estado' },
      { key: 'opportunities_count', header: 'Oportunidades' },
      { key: 'open_pipeline', header: 'Pipeline abierto' },
      { key: 'sales_count', header: 'Ventas' },
      { key: 'total_sold', header: 'Total vendido' },
      { key: 'receivable', header: 'Por cobrar' },
      { key: 'courts_count', header: 'Canchas' },
      { key: 'last_activity_at', header: 'Última actividad' },
    ],
  },
};

export type ExportKey = keyof typeof EXPORTS;
