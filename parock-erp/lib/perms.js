// Catálogo de módulos y acciones que un rol puede tener.
export const MODS = [
  ['inicio', 'Inicio / dashboard', ['ver']],
  ['crm', 'Clientes y CRM', ['ver', 'crear', 'editar', 'eliminar']],
  ['productos', 'Productos', ['ver', 'crear', 'editar', 'eliminar']],
  ['precios', 'Listas de precio', ['ver', 'editar']],
  ['costos', 'Costos y márgenes', ['ver', 'editar']],
  ['oc', 'Órdenes de compra', ['ver', 'crear', 'editar', 'eliminar', 'aprobar']],
  ['despachos', 'Despachos y servicio', ['ver', 'crear', 'editar', 'eliminar']],
  ['inventario', 'Inventario ROVAL', ['ver', 'editar', 'importar']],
  ['forecast', 'Forecast', ['ver', 'editar', 'congelar']],
  ['abastecimiento', 'Abastecimiento', ['ver']],
  ['facturas', 'Facturas y cobranza', ['ver', 'crear', 'editar', 'eliminar']],
  ['finanzas', 'Finanzas, gastos e IVA', ['ver', 'crear', 'editar', 'eliminar']],
  ['admin', 'Administración (usuarios, roles, auditoría)', ['ver', 'editar']]
];

export const ALL_PERMS = Object.fromEntries(MODS.map(([k, , a]) => [k, a]));

export const can = (u, mod, act = 'ver') => !!(u && u.perms && Array.isArray(u.perms[mod]) && u.perms[mod].includes(act));

// Limpia un objeto de permisos dejando solo módulos/acciones válidos
export function cleanPerms(p) {
  const out = {};
  for (const [k, , acts] of MODS) {
    const v = Array.isArray(p?.[k]) ? p[k].filter(a => acts.includes(a)) : [];
    if (v.length && !v.includes('ver')) v.unshift('ver');
    if (v.length) out[k] = [...new Set(v)];
  }
  return out;
}
