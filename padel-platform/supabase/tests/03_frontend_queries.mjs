/**
 * 03_frontend_queries.mjs
 *
 * Verificacion end-to-end de la capa de datos del frontend.
 *
 * Reproduce, una a una, las consultas PostgREST que emiten las paginas de
 * la aplicacion, autenticando con el JWT de cada usuario demo. Esto detecta
 * lo que ni TypeScript ni `next build` pueden ver:
 *   - nombres de columna equivocados
 *   - sintaxis incorrecta en recursos embebidos (ej. `clients(company_name)`)
 *   - relaciones ambiguas que PostgREST no sabe resolver
 *   - filas bloqueadas por RLS cuando deberian ser visibles (y al reves)
 *
 * Uso:
 *   API_URL=http://127.0.0.1:3999 JWT_SECRET=... node 03_frontend_queries.mjs
 */

import { createHmac } from 'node:crypto';

const API = process.env.API_URL ?? 'http://127.0.0.1:3999';
const SECRET = process.env.JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';

const b64 = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

function mintJwt(sub) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    sub,
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const signature = createHmac('sha256', SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const USERS = {
  admin: 'b0000000-0000-4000-8000-000000000001',
  comercial: 'b0000000-0000-4000-8000-000000000002',
  operaciones: 'b0000000-0000-4000-8000-000000000003',
  finanzas: 'b0000000-0000-4000-8000-000000000004',
};

const PROJECTS = {
  EUROPA: 'a0000000-0000-4000-8000-000000000001',
  ATILA: 'a0000000-0000-4000-8000-000000000002',
  VENTA_USADAS: 'a0000000-0000-4000-8000-000000000003',
};

let passed = 0;
let failed = 0;

async function query(user, path, { count = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${mintJwt(USERS[user])}`,
      Accept: 'application/json',
      ...(count ? { Prefer: 'count=exact' } : {}),
    },
  });
  const body = await res.text();
  return {
    status: res.status,
    contentRange: res.headers.get('content-range'),
    data: body ? JSON.parse(body) : null,
  };
}

/** Comprueba que la consulta de una pagina responde 200 y devuelve filas. */
async function check(label, user, path, expect = {}) {
  const { status, data } = await query(user, path, { count: true });

  if (status !== 200) {
    console.error(`  FALLO  ${label}\n         HTTP ${status} :: ${JSON.stringify(data)}`);
    failed++;
    return null;
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];

  if (expect.minRows !== undefined && rows.length < expect.minRows) {
    console.error(`  FALLO  ${label}\n         esperaba >= ${expect.minRows} filas, obtuvo ${rows.length}`);
    failed++;
    return rows;
  }
  if (expect.exactRows !== undefined && rows.length !== expect.exactRows) {
    console.error(`  FALLO  ${label}\n         esperaba ${expect.exactRows} filas, obtuvo ${rows.length}`);
    failed++;
    return rows;
  }
  if (expect.columns) {
    const missing = expect.columns.filter((c) => rows[0] === undefined || !(c in rows[0]));
    if (missing.length > 0) {
      console.error(`  FALLO  ${label}\n         faltan columnas: ${missing.join(', ')}`);
      failed++;
      return rows;
    }
  }

  console.log(`  ok     ${label} (${rows.length} filas)`);
  passed++;
  return rows;
}

async function main() {
  const EU = PROJECTS.EUROPA;
  const US = PROJECTS.VENTA_USADAS;

  console.log('\n== Sesion y navegacion ==');
  const ctx = await query('admin', '/rpc/get_session_context');
  if (ctx.status === 200 && ctx.data?.projects?.length === 3) {
    console.log(`  ok     get_session_context (3 proyectos, ${ctx.data.projects[0].permissions.length} permisos)`);
    passed++;
  } else {
    console.error(`  FALLO  get_session_context :: ${JSON.stringify(ctx.data)}`);
    failed++;
  }

  // El layout cuenta alertas y tareas con head+count
  await check('layout · contador de alertas', 'admin',
    `/alerts?select=id&project_id=eq.${EU}&status=in.(ABIERTA,RECONOCIDA,EN_GESTION)`, { minRows: 1 });
  await check('layout · contador de tareas', 'admin',
    `/tasks?select=id&project_id=eq.${EU}&status=in.(PENDIENTE,EN_CURSO,BLOQUEADA)`, { minRows: 1 });

  console.log('\n== Dashboard ==');
  await check('dashboard · KPIs globales', 'admin',
    `/v_dashboard_global?select=*&project_id=eq.${EU}`,
    { exactRows: 1, columns: [
      'pipeline_amount', 'closed_sales', 'courts_in_transit', 'courts_pending_delivery',
      'total_collected', 'accounts_receivable', 'accounts_payable',
      'projected_margin', 'projected_margin_pct', 'delayed_manufacturing', 'critical_alerts',
    ]});

  await check('dashboard · ventas recientes', 'admin',
    `/v_sale_financials?select=*&project_id=eq.${EU}&status=not.in.("ANULADA","BORRADOR")&order=sale_date.desc&limit=8`,
    { minRows: 1, columns: ['sale_number', 'delivery_state', 'projected_margin_percentage', 'has_actual_cost'] });

  console.log('\n== Ventas ==');
  const sales = await check('ventas · listado paginado', 'admin',
    `/v_sale_financials?select=*&project_id=eq.${EU}&order=sale_date.desc&limit=25`, { minRows: 5 });

  const saleId = sales?.find((s) => s.sale_number === 'EUROPA-2026-0001')?.sale_id;

  await check('ventas · busqueda libre', 'admin',
    `/v_sale_financials?select=*&project_id=eq.${EU}&or=(sale_number.ilike.*0001*,client_name.ilike.*0001*)`,
    { minRows: 1 });
  await check('ventas · filtro por estado', 'admin',
    `/v_sale_financials?select=*&project_id=eq.${EU}&status=eq.EN_PRODUCCION`, { minRows: 1 });

  console.log('\n== Ficha de venta ==');
  await check('ficha · lineas', 'admin',
    `/sale_items?select=*&sale_id=eq.${saleId}&order=sort_order`, { minRows: 3 });
  await check('ficha · canchas', 'admin',
    `/courts?select=*&sale_id=eq.${saleId}&deleted_at=is.null&order=court_number`, { exactRows: 4 });
  await check('ficha · desviacion de costos', 'admin',
    `/v_sale_cost_variance?select=*&sale_id=eq.${saleId}`,
    { minRows: 1, columns: ['cost_group', 'estimated_amount', 'actual_amount', 'deviation_pct'] });
  await check('ficha · timeline', 'admin',
    `/project_events?select=*&entity_type=eq.SALE&entity_id=eq.${saleId}&order=event_date.desc&limit=25`,
    { minRows: 1 });
  await check('ficha · checklist embebido', 'admin',
    `/project_checklists?select=id,name,checklist_items(*)&entity_type=eq.SALE&entity_id=eq.${saleId}`,
    { exactRows: 1 });
  await check('ficha · facturas', 'admin',
    `/invoices?select=id,invoice_number,invoice_date,due_date,total,paid_amount,balance,status,currency&sale_id=eq.${saleId}&deleted_at=is.null`,
    { minRows: 1 });
  await check('ficha · resumen de fabricacion', 'admin',
    `/v_manufacturing_summary?select=*&sale_id=eq.${saleId}`, { exactRows: 1 });

  console.log('\n== Canchas ==');
  const courts = await check('canchas · listado', 'admin',
    `/courts?select=*&project_id=eq.${EU}&deleted_at=is.null&order=court_number.asc&limit=25`, { minRows: 5 });
  const courtId = courts?.[0]?.id;

  await check('cancha · historial de estados', 'admin',
    `/court_status_history?select=*&court_id=eq.${courtId}&order=changed_at.desc`, { minRows: 1 });
  await check('cancha · embarque embebido', 'admin',
    `/shipment_items?select=shipment_id,shipments(shipment_number,status,estimated_arrival,destination)&court_id=eq.${courtId}`);

  console.log('\n== Comercial ==');
  await check('clientes · listado 360', 'admin',
    `/v_client_360?select=*&project_id=eq.${EU}&order=total_sold.desc&limit=25`,
    { exactRows: 5, columns: ['open_pipeline', 'total_sold', 'receivable', 'overdue_follow_ups'] });
  await check('cliente · contactos', 'admin',
    `/contacts?select=*&client_id=eq.c0000000-0000-4000-8000-000000000001&deleted_at=is.null&order=is_primary.desc`,
    { minRows: 1 });
  await check('cliente · actividad comercial', 'admin',
    `/commercial_activities?select=id,activity_type,activity_date,subject,result&client_id=eq.c0000000-0000-4000-8000-000000000001&order=activity_date.desc&limit=8`,
    { minRows: 1 });
  await check('oportunidades · kanban con cliente embebido', 'admin',
    `/opportunities?select=id,name,status,estimated_amount,estimated_courts,currency,probability,expected_close_date,next_action,next_action_date,client_id,clients(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=expected_close_date.asc`,
    { exactRows: 15 });
  await check('seguimientos · con cliente embebido', 'admin',
    `/follow_ups?select=id,title,description,due_date,priority,status,client_id,clients(company_name)&project_id=eq.${EU}&order=due_date.asc&limit=25`,
    { minRows: 4 });
  await check('reuniones', 'admin',
    `/meetings?select=id,meeting_date,start_time,meeting_type,status,objective,summary,clients(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=meeting_date.desc&limit=25`,
    { minRows: 3 });

  console.log('\n== Operaciones ==');
  await check('fabricacion · resumen', 'admin',
    `/v_manufacturing_summary?select=*&project_id=eq.${EU}&order=estimated_completion_date.asc`,
    { minRows: 2, columns: ['progress_pct', 'materials_missing', 'is_delayed', 'days_to_deadline'] });
  await check('fabricacion · solo atrasados', 'admin',
    `/v_manufacturing_summary?select=*&project_id=eq.${EU}&is_delayed=eq.true`, { minRows: 1 });
  await check('materiales · requerimientos', 'admin',
    `/material_requirements?select=id,quantity_required,quantity_available,quantity_purchased,quantity_missing,needed_by_date,materials(code,name,unit),manufacturing_projects(name)&project_id=eq.${EU}&order=needed_by_date.asc&limit=25`,
    { minRows: 4 });
  await check('proveedores', 'admin',
    `/suppliers?select=id,company_name,tax_id,country,city,category,contact_name,email,phone,status,payment_terms&project_id=eq.${EU}&deleted_at=is.null&order=company_name.asc&limit=25`,
    { minRows: 4 });
  await check('ordenes de compra', 'admin',
    `/purchase_orders?select=id,po_number,order_date,expected_delivery_date,status,currency,total,suppliers(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=order_date.desc&limit=25`,
    { minRows: 1 });
  await check('logistica · embarques', 'admin',
    `/shipments?select=id,shipment_number,transport_mode,origin,destination,carrier,container_number,bl_number,departure_date,estimated_arrival,customs_status,status&project_id=eq.${EU}&deleted_at=is.null&order=departure_date.desc&limit=25`,
    { exactRows: 3 });
  await check('instalaciones', 'admin',
    `/installations?select=id,installation_number,name,city,country,planned_start_date,planned_end_date,actual_end_date,status,clients(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=planned_start_date.desc&limit=25`,
    { exactRows: 3 });
  await check('calidad', 'admin',
    `/quality_checks?select=id,check_type,check_date,result,score,observations,courts(court_number)&project_id=eq.${EU}&order=check_date.desc&limit=25`,
    { minRows: 1 });
  await check('inventario de usadas', 'admin',
    `/v_used_courts_inventory?select=*&project_id=eq.${US}&order=court_number`,
    { exactRows: 10, columns: ['total_cost', 'sale_price', 'margin'] });

  console.log('\n== Finanzas ==');
  await check('facturas · venta y compra', 'finanzas',
    `/invoices?select=id,kind,invoice_number,external_number,invoice_date,due_date,status,currency,total,paid_amount,balance,sale_id,clients(company_name),suppliers(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=invoice_date.desc&limit=25`,
    { minRows: 3 });
  await check('resumen financiero', 'finanzas',
    `/v_financial_summary?select=*&project_id=eq.${EU}`,
    { exactRows: 1, columns: ['accounts_receivable', 'accounts_payable', 'overdue_receivable'] });
  await check('pagos', 'finanzas',
    `/payments?select=id,direction,payment_date,amount,currency,method,reference,invoices(invoice_number),clients(company_name),suppliers(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=payment_date.desc&limit=25`,
    { minRows: 2 });
  await check('contratos', 'finanzas',
    `/contracts?select=id,contract_number,title,contract_date,end_date,amount,currency,status,sale_id,clients(company_name)&project_id=eq.${EU}&deleted_at=is.null&order=contract_date.desc&limit=25`,
    { minRows: 1 });
  await check('gastos', 'finanzas',
    `/expenses?select=id,description,expense_date,amount,currency,status,cost_categories(name,cost_group),sales(sale_number)&project_id=eq.${EU}&deleted_at=is.null&order=expense_date.desc&limit=25`,
    { minRows: 3 });
  await check('bancos · cuentas', 'finanzas',
    `/bank_accounts?select=*&project_id=eq.${EU}&deleted_at=is.null&order=name`, { minRows: 2 });
  await check('rentabilidad', 'admin',
    `/v_sale_financials?select=*&project_id=eq.${EU}&status=not.in.("ANULADA","BORRADOR")&order=sale_date.desc`,
    { minRows: 4 });
  await check('cuentas por cobrar con aging', 'finanzas',
    `/v_accounts_receivable?select=*&project_id=eq.${EU}`,
    { minRows: 1, columns: ['aging_bucket', 'days_overdue', 'balance'] });

  console.log('\n== Control Center / Hoy / Documentos / Config ==');
  await check('control center', 'admin',
    `/v_control_center?select=*&project_id=eq.${EU}&order=priority.asc&order=last_detected_at.desc`,
    { minRows: 5, columns: ['bucket', 'tasks_count'] });
  await check('agenda (hoy + 7 dias)', 'admin',
    `/v_agenda?select=*&project_id=eq.${EU}&event_date=not.is.null&order=event_date.asc`, { minRows: 5 });
  await check('documentos', 'admin',
    `/documents?select=id,name,bucket,storage_path,mime_type,file_size,status,is_confidential,created_at,document_types(name,category)&project_id=eq.${EU}&deleted_at=is.null&order=created_at.desc&limit=25`);
  await check('tareas', 'admin',
    `/tasks?select=id,title,description,due_date,priority,status,related_entity_type&project_id=eq.${EU}&order=due_date.asc&limit=25`,
    { minRows: 2 });
  await check('configuracion · modulos', 'admin',
    `/project_modules?select=module_code,enabled,modules(name,category)&project_id=eq.${EU}`, { minRows: 20 });
  await check('configuracion · usuarios con acceso', 'admin',
    `/user_project_access?select=id,active,profiles!user_project_access_user_id_fkey(full_name,email),roles(code,name)&project_id=eq.${EU}`,
    { minRows: 4 });

  console.log('\n== RLS a traves de la API (lo que ve cada rol) ==');
  const comercialAtila = await query('comercial', `/clients?select=id&project_id=eq.${PROJECTS.ATILA}`);
  if (comercialAtila.status === 200 && comercialAtila.data.length === 0) {
    console.log('  ok     comercial no ve clientes de ATILA');
    passed++;
  } else {
    console.error(`  FALLO  comercial vio ${comercialAtila.data?.length} clientes de ATILA`);
    failed++;
  }

  const comercialBancos = await query('comercial', `/bank_accounts?select=id&project_id=eq.${EU}`);
  if (comercialBancos.status === 200 && comercialBancos.data.length === 0) {
    console.log('  ok     comercial no ve cuentas bancarias');
    passed++;
  } else {
    console.error(`  FALLO  comercial vio cuentas bancarias`);
    failed++;
  }

  const opsPagos = await query('operaciones', `/payments?select=id&project_id=eq.${EU}`);
  if (opsPagos.status === 200 && opsPagos.data.length === 0) {
    console.log('  ok     operaciones no ve pagos');
    passed++;
  } else {
    console.error('  FALLO  operaciones vio pagos');
    failed++;
  }

  // Escritura: operaciones NO puede modificar una venta
  const opsWrite = await fetch(`${API}/sales?sale_number=eq.EUROPA-2026-0001`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${mintJwt(USERS.operaciones)}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ notes: 'intento no autorizado' }),
  });
  const opsWriteBody = await opsWrite.json();
  if (Array.isArray(opsWriteBody) && opsWriteBody.length === 0) {
    console.log('  ok     operaciones no puede modificar ventas (0 filas afectadas)');
    passed++;
  } else {
    console.error(`  FALLO  operaciones modifico ventas :: ${JSON.stringify(opsWriteBody)}`);
    failed++;
  }

  // RPC de negocio expuesto a la app
  const rpc = await fetch(`${API}/rpc/confirm_sale`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mintJwt(USERS.operaciones)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_sale_id: saleId }),
  });
  const rpcBody = await rpc.json();
  if (rpc.status >= 400 && JSON.stringify(rpcBody).includes('sales.approve')) {
    console.log('  ok     confirm_sale rechaza a operaciones (falta sales.approve)');
    passed++;
  } else {
    console.error(`  FALLO  confirm_sale no aplico el permiso :: ${rpc.status} ${JSON.stringify(rpcBody)}`);
    failed++;
  }

  console.log('\n' + '-'.repeat(54));
  console.log(` ${passed} consultas OK · ${failed} fallos`);
  console.log('-'.repeat(54));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
