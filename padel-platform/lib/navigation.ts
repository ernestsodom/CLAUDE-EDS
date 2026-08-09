/**
 * Definicion del menu (§72).
 *
 * El menu no esta hardcodeado en el componente: se declara aqui y se
 * filtra en tiempo de render por (a) modulos habilitados en el proyecto y
 * (b) permisos efectivos del usuario. Habilitar o quitar un modulo a un
 * proyecto es un UPDATE en `project_modules`, no un despliegue.
 */
export interface NavItem {
  label: string;
  href: string;          // relativo al proyecto: se antepone /{PROJECT_CODE}
  module: string;        // debe estar habilitado y el usuario tener <module>.view
  icon: string;          // nombre de icono lucide
  badge?: 'alerts' | 'tasks';
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', href: '/dashboard', module: 'dashboard', icon: 'LayoutDashboard' },
      { label: 'Hoy', href: '/hoy', module: 'calendar', icon: 'CalendarClock' },
      {
        label: 'Control Center',
        href: '/control-center',
        module: 'control_center',
        icon: 'Siren',
        badge: 'alerts',
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', href: '/comercial/clientes', module: 'clients', icon: 'Building2' },
      { label: 'Oportunidades', href: '/comercial/oportunidades', module: 'opportunities', icon: 'Target' },
      { label: 'Reuniones', href: '/comercial/reuniones', module: 'meetings', icon: 'CalendarCheck' },
      { label: 'Seguimientos', href: '/comercial/seguimientos', module: 'follow_ups', icon: 'BellRing' },
      { label: 'Ventas', href: '/ventas', module: 'sales', icon: 'Handshake' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Fabricacion', href: '/operaciones/fabricacion', module: 'manufacturing', icon: 'Factory' },
      { label: 'Canchas', href: '/operaciones/canchas', module: 'courts', icon: 'LayoutGrid' },
      { label: 'Inventario usadas', href: '/operaciones/inventario', module: 'used_inventory', icon: 'Warehouse' },
      { label: 'Materiales', href: '/operaciones/materiales', module: 'materials', icon: 'Boxes' },
      { label: 'Proveedores', href: '/operaciones/proveedores', module: 'suppliers', icon: 'Truck' },
      { label: 'Ordenes de compra', href: '/operaciones/compras', module: 'purchases', icon: 'ShoppingCart' },
      { label: 'Logistica', href: '/operaciones/logistica', module: 'logistics', icon: 'Ship' },
      { label: 'Instalaciones', href: '/operaciones/instalaciones', module: 'installations', icon: 'HardHat' },
      { label: 'Calidad', href: '/operaciones/calidad', module: 'quality', icon: 'BadgeCheck' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { label: 'Contratos', href: '/finanzas/contratos', module: 'contracts', icon: 'FileSignature' },
      { label: 'Facturas', href: '/finanzas/facturas', module: 'invoices', icon: 'Receipt' },
      { label: 'Pagos', href: '/finanzas/pagos', module: 'payments', icon: 'Banknote' },
      { label: 'Gastos', href: '/finanzas/gastos', module: 'expenses', icon: 'CreditCard' },
      { label: 'Bancos', href: '/finanzas/bancos', module: 'banks', icon: 'Landmark' },
      { label: 'Rentabilidad', href: '/finanzas/rentabilidad', module: 'profitability', icon: 'TrendingUp' },
    ],
  },
  {
    label: null,
    items: [
      { label: 'Documentos', href: '/documentos', module: 'documents', icon: 'FolderOpen' },
      { label: 'Tareas', href: '/tareas', module: 'tasks', icon: 'CheckSquare', badge: 'tasks' },
      { label: 'Reportes', href: '/reportes', module: 'reports', icon: 'BarChart3' },
      { label: 'Configuracion', href: '/configuracion', module: 'settings', icon: 'Settings' },
    ],
  },
];
