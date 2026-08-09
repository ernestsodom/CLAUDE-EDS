/**
 * 04_frontend_writes.mjs
 *
 * Verificacion end-to-end de los formularios de alta y edicion.
 *
 * Las Server Actions escriben con el cliente Supabase del usuario, asi que
 * acaban siendo exactamente estas llamadas PostgREST. Reproducirlas con el
 * JWT de cada rol comprueba de verdad:
 *   - que los INSERT/UPDATE de cada formulario son aceptados
 *   - que los triggers recalculan totales, saldos y estados
 *   - que RLS impide crear o modificar lo que el rol no puede
 *   - que los CHECK de negocio rechazan datos incoherentes
 *
 * Limpia todo lo que crea, de modo que puede ejecutarse varias veces.
 *
 * Uso:
 *   API_URL=http://127.0.0.1:3999 JWT_SECRET=... node 04_frontend_writes.mjs
 */

import { createHmac } from 'node:crypto';

const API = process.env.API_URL ?? 'http://127.0.0.1:3999';
const SECRET = process.env.JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function mintJwt(sub) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
  const signature = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const USERS = {
  admin: 'b0000000-0000-4000-8000-000000000001',
  comercial: 'b0000000-0000-4000-8000-000000000002',
  operaciones: 'b0000000-0000-4000-8000-000000000003',
  finanzas: 'b0000000-0000-4000-8000-000000000004',
};

const EUROPA = 'a0000000-0000-4000-8000-000000000001';
const ATILA = 'a0000000-0000-4000-8000-000000000002';

let passed = 0;
let failed = 0;
const cleanup = [];

async function call(user, method, path, body, prefer = 'return=representation') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${mintJwt(USERS[user])}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: prefer,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

function ok(label, extra = '') {
  console.log(`  ok     ${label}${extra ? ` (${extra})` : ''}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  FALLO  ${label}\n         ${detail}`);
  failed++;
}

/** Espera que la escritura sea aceptada. Devuelve la fila creada. */
async function expectWrite(label, user, method, path, body) {
  const { status, data } = await call(user, method, path, body);
  if (status >= 200 && status < 300 && Array.isArray(data) && data.length > 0) {
    ok(label);
    return data[0];
  }
  fail(label, `HTTP ${status} :: ${JSON.stringify(data)}`);
  return null;
}

/** Espera que la escritura sea rechazada (RLS o constraint). */
async function expectRejected(label, user, method, path, body, reason) {
  const { status, data } = await call(user, method, path, body);

  // Un 5xx significa que la API no esta sana, no que la regla funcione.
  // Contarlo como exito convertiria esta suite en un adorno.
  if (status >= 500) {
    fail(label, `la API respondio ${status}; la prueba no es concluyente :: ${JSON.stringify(data)}`);
    return;
  }

  const blockedByRuleOrPermission = status >= 400;
  const noRowsAffected = status >= 200 && status < 300 && Array.isArray(data) && data.length === 0;

  if (noRowsAffected || blockedByRuleOrPermission) {
    ok(label, reason);
    return;
  }
  fail(label, `se permitio la escritura :: HTTP ${status} ${JSON.stringify(data)}`);
}

async function main() {
  console.log('\n== Altas basicas (formularios simples) ==');

  const supplier = await expectWrite('alta de proveedor', 'admin', 'POST', '/suppliers', {
    project_id: EUROPA,
    company_name: 'Proveedor de prueba automatizada',
    country: 'ES',
    category: 'FIERRO',
    currency: 'EUR',
    status: 'ACTIVO',
  });
  if (supplier) cleanup.push(['suppliers', supplier.id]);

  if (supplier) {
    const updated = await expectWrite('edicion de proveedor', 'admin', 'PATCH',
      `/suppliers?id=eq.${supplier.id}`, { payment_terms: '90 dias', rating: 4 });
    if (updated?.payment_terms === '90 dias') ok('la edicion persistio');
    else fail('la edicion persistio', JSON.stringify(updated));
  }

  const bank = await expectWrite('alta de cuenta bancaria', 'admin', 'POST', '/bank_accounts', {
    project_id: EUROPA, name: 'Cuenta de prueba', currency: 'EUR', opening_balance: 1000, active: true,
  });
  if (bank) cleanup.push(['bank_accounts', bank.id]);

  const client = await expectWrite('alta de cliente', 'comercial', 'POST', '/clients', {
    project_id: EUROPA, company_name: 'Cliente de prueba automatizada',
    country: 'ES', status: 'PROSPECTO',
  });
  if (client) cleanup.push(['clients', client.id]);

  console.log('\n== Venta: cabecera, lineas y recalculo por trigger ==');

  const sale = await expectWrite('alta de venta', 'comercial', 'POST', '/sales', {
    project_id: EUROPA,
    client_id: client?.id,
    sale_date: new Date().toISOString().slice(0, 10),
    status: 'BORRADOR',
    currency: 'EUR',
    tax_rate: 0,
  });
  if (sale) cleanup.push(['sales', sale.id]);

  if (sale) {
    if (/^EUROPA-\d{4}-\d{4}$/.test(sale.sale_number)) {
      ok('numero de venta generado por el trigger', sale.sale_number);
    } else {
      fail('numero de venta generado por el trigger', sale.sale_number);
    }

    await expectWrite('alta de linea de venta', 'comercial', 'POST', '/sale_items', {
      project_id: EUROPA, sale_id: sale.id, product_type: 'CANCHA_NUEVA',
      description: 'Cancha de prueba', quantity: 3, unit_price: 10000, estimated_unit_cost: 6000,
    });

    const { data: refreshed } = await call('comercial', 'GET', `/sales?id=eq.${sale.id}&select=total,subtotal`);
    const total = Number(refreshed?.[0]?.total ?? 0);
    if (total === 30000) ok('el trigger recalculo el total de la venta', '30.000 EUR');
    else fail('el trigger recalculo el total de la venta', `total = ${total}`);

    // Una linea con descuento superior al importe viola sale_items_discount_ck
    await expectRejected('descuento mayor que la linea rechazado', 'comercial', 'POST', '/sale_items', {
      project_id: EUROPA, sale_id: sale.id, product_type: 'ACCESORIOS',
      description: 'Descuento imposible', quantity: 1, unit_price: 100, discount: 500,
    }, 'CHECK sale_items_discount_ck');
  }

  console.log('\n== Factura y pago: saldo y estado derivados ==');

  const invoice = await expectWrite('alta de factura de venta', 'finanzas', 'POST', '/invoices', {
    project_id: EUROPA, kind: 'VENTA', client_id: client?.id,
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: 'EMITIDA', currency: 'EUR', tax_rate: 0, sale_id: sale?.id,
  });
  if (invoice) cleanup.push(['invoices', invoice.id]);

  if (invoice) {
    await expectWrite('alta de linea de factura', 'finanzas', 'POST', '/invoice_items', {
      project_id: EUROPA, invoice_id: invoice.id,
      description: 'Suministro de prueba', quantity: 1, unit_price: 5000,
    });

    const { data: inv1 } = await call('finanzas', 'GET', `/invoices?id=eq.${invoice.id}&select=total,balance,status`);
    if (Number(inv1?.[0]?.total) === 5000) ok('el trigger recalculo el total de la factura', '5.000 EUR');
    else fail('el trigger recalculo el total de la factura', JSON.stringify(inv1?.[0]));

    const payment = await expectWrite('registro de cobro', 'finanzas', 'POST', '/payments', {
      project_id: EUROPA, direction: 'ENTRADA',
      payment_date: new Date().toISOString().slice(0, 10),
      amount: 2000, currency: 'EUR', method: 'TRANSFERENCIA',
      invoice_id: invoice.id, client_id: client?.id,
    });
    if (payment) cleanup.push(['payments', payment.id]);

    const { data: inv2 } = await call('finanzas', 'GET', `/invoices?id=eq.${invoice.id}&select=paid_amount,balance,status`);
    const row = inv2?.[0];
    if (Number(row?.paid_amount) === 2000 && Number(row?.balance) === 3000) {
      ok('el pago actualizo saldo de la factura', 'pagado 2.000 · saldo 3.000');
    } else {
      fail('el pago actualizo saldo de la factura', JSON.stringify(row));
    }
    if (row?.status === 'PARCIALMENTE_PAGADA') ok('la factura paso a PARCIALMENTE_PAGADA');
    else fail('la factura paso a PARCIALMENTE_PAGADA', String(row?.status));

    // Una factura de venta no puede llevar proveedor (invoices_party_ck)
    await expectRejected('factura de venta con proveedor rechazada', 'finanzas', 'POST', '/invoices', {
      project_id: EUROPA, kind: 'VENTA', client_id: client?.id,
      supplier_id: supplier?.id, invoice_date: new Date().toISOString().slice(0, 10),
      currency: 'EUR',
    }, 'CHECK invoices_party_ck');
  }

  console.log('\n== Reglas de negocio en la base ==');

  await expectRejected('cancha nueva con estado de usada rechazada', 'operaciones', 'POST', '/courts', {
    project_id: EUROPA, court_type: 'NUEVA', status: 'EN_REPARACION', currency: 'EUR',
  }, 'CHECK courts_status_domain_ck');

  const court = await expectWrite('alta de cancha con estado valido', 'operaciones', 'POST', '/courts', {
    project_id: EUROPA, court_type: 'NUEVA', status: 'PLANIFICADA', currency: 'EUR',
    model: 'PRUEBA-AUTOMATIZADA',
  });
  if (court) {
    cleanup.push(['courts', court.id]);
    if (/^EUROPA-\d{4}$/.test(court.court_number)) {
      ok('numero de cancha generado por el trigger', court.court_number);
    } else {
      fail('numero de cancha generado por el trigger', court.court_number);
    }
  }

  await expectRejected('oportunidad perdida sin motivo rechazada', 'comercial', 'POST', '/opportunities', {
    project_id: EUROPA, client_id: client?.id, name: 'Perdida sin motivo', status: 'PERDIDA',
  }, 'CHECK opportunities_lost_ck');

  await expectRejected('gasto con importe negativo rechazado', 'finanzas', 'POST', '/expenses', {
    project_id: EUROPA, description: 'Importe imposible',
    expense_date: new Date().toISOString().slice(0, 10), amount: -100, currency: 'EUR',
  }, 'CHECK expenses_amount_ck');

  console.log('\n== Permisos de escritura por rol ==');

  await expectRejected('comercial no puede crear proveedores', 'comercial', 'POST', '/suppliers', {
    project_id: EUROPA, company_name: 'Proveedor no permitido',
  }, 'sin suppliers.create');

  await expectRejected('operaciones no puede crear facturas', 'operaciones', 'POST', '/invoices', {
    project_id: EUROPA, kind: 'VENTA', client_id: client?.id,
    invoice_date: new Date().toISOString().slice(0, 10), currency: 'EUR',
  }, 'sin invoices.create');

  await expectRejected('finanzas no puede crear canchas', 'finanzas', 'POST', '/courts', {
    project_id: EUROPA, court_type: 'NUEVA', status: 'PLANIFICADA', currency: 'EUR',
  }, 'sin courts.create');

  await expectRejected('comercial no puede crear clientes en ATILA', 'comercial', 'POST', '/clients', {
    project_id: ATILA, company_name: 'Cliente intruso', status: 'PROSPECTO',
  }, 'sin acceso al proyecto');

  if (supplier) {
    await expectRejected('comercial no puede editar un proveedor', 'comercial', 'PATCH',
      `/suppliers?id=eq.${supplier.id}`, { company_name: 'Renombrado sin permiso' },
      'sin suppliers.update');
  }

  // Aislamiento entre proyectos: una venta de EUROPA no admite un cliente de ATILA
  await expectRejected('venta que cruza proyectos rechazada', 'admin', 'POST', '/sales', {
    project_id: EUROPA, client_id: 'c0000000-0000-4000-8000-000000000011',
    sale_date: new Date().toISOString().slice(0, 10), currency: 'EUR',
  }, 'trigger de aislamiento multi-tenant');

  // ------------------------------------------------------------------
  // Limpieza
  // ------------------------------------------------------------------
  console.log('\n== Limpieza ==');
  for (const [table, id] of cleanup.reverse()) {
    await call('admin', 'DELETE', `/${table}?id=eq.${id}`, null, 'return=minimal');
  }
  ok(`${cleanup.length} registros de prueba eliminados`);

  console.log('\n' + '-'.repeat(54));
  console.log(` ${passed} comprobaciones OK · ${failed} fallos`);
  console.log('-'.repeat(54));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
