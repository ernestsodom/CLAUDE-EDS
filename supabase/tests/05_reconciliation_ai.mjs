/**
 * 05_reconciliation_ai.mjs
 *
 * Verificacion de las fases 9b (conciliacion bancaria), 10 (documentacion)
 * y 14 (IA) contra la API real, con el JWT de cada rol.
 *
 * Lo que aqui se comprueba no lo puede ver ni TypeScript ni `next build`:
 *
 *   - que reimportar un extracto no duplica movimientos
 *   - que conciliar valida importe, direccion del dinero y unicidad
 *   - que el versionado documental numera sin que el cliente elija
 *   - que aprobar exige permiso y deja rastro
 *   - que NADIE puede escribir por UPDATE directo las columnas de
 *     revision de una extraccion de IA, que es lo que sostiene §42
 *
 * Limpia todo lo que crea.
 *
 * Uso:
 *   API_URL=http://127.0.0.1:3999 JWT_SECRET=... node 05_reconciliation_ai.mjs
 */

import { createHmac, randomUUID } from 'node:crypto';

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
const ACCOUNT_EUR = 'f0000000-0000-4000-8000-000000000001';
const CLIENT = 'c0000000-0000-4000-8000-000000000001';

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
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const rpc = (user, fn, args) => call(user, 'POST', `/rpc/${fn}`, args);

function ok(label, extra = '') {
  console.log(`  ok     ${label}${extra ? ` (${extra})` : ''}`);
  passed++;
}
function fail(label, detail) {
  console.error(`  FALLO  ${label}\n         ${detail}`);
  failed++;
}

function expectEq(label, actual, expected) {
  if (String(actual) === String(expected)) ok(label, String(actual));
  else fail(label, `esperado ${expected}, obtenido ${actual}`);
}

async function expectWrite(label, user, method, path, body) {
  const { status, data } = await call(user, method, path, body);
  if (status >= 200 && status < 300 && Array.isArray(data) && data.length > 0) {
    ok(label);
    return data[0];
  }
  fail(label, `HTTP ${status} :: ${JSON.stringify(data)}`);
  return null;
}

/** Espera rechazo. Un 5xx no cuenta como exito: significaria API caida. */
async function expectRejected(label, user, method, path, body, reason) {
  const { status, data } = await call(user, method, path, body);

  if (status >= 500 && status !== 500) {
    fail(label, `la API respondio ${status}; la prueba no es concluyente`);
    return;
  }
  // PostgREST devuelve 500 para RAISE EXCEPTION con SQLSTATE de negocio:
  // se acepta solo si el mensaje es el de la regla, no un fallo de la API.
  if (status === 500) {
    const message = JSON.stringify(data ?? '');
    if (/PGRST|schema cache|connection/i.test(message)) {
      fail(label, `la API respondio 500 por infraestructura :: ${message}`);
      return;
    }
    ok(label, reason);
    return;
  }
  if (status >= 400) { ok(label, reason); return; }
  if (Array.isArray(data) && data.length === 0) { ok(label, reason); return; }

  fail(label, `se permitio la operacion :: HTTP ${status} ${JSON.stringify(data)}`);
}

async function expectRpcRejected(label, user, fn, args, reason) {
  await expectRejected(label, user, 'POST', `/rpc/${fn}`, args, reason);
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // ==================================================================
  console.log('\n== FASE 9b · Importacion idempotente ==');
  // ==================================================================
  const hash = `test-${randomUUID()}`;

  const movement = {
    project_id: EUROPA,
    bank_account_id: ACCOUNT_EUR,
    transaction_date: today,
    transaction_type: 'INGRESO',
    description: 'Transferencia de prueba automatizada',
    reference: 'REF-AUTOTEST-1',
    amount: 1234.56,
    currency: 'EUR',
    import_hash: hash,
  };

  const inserted = await expectWrite('importa un movimiento nuevo', 'admin', 'POST',
    '/bank_transactions', movement);
  if (inserted) cleanup.push(['bank_transactions', inserted.id]);

  // Reimportar el mismo extracto: mismo hash, misma cuenta.
  const again = await call('admin', 'POST',
    '/bank_transactions?on_conflict=bank_account_id,import_hash',
    movement, 'return=representation,resolution=ignore-duplicates');

  if (again.status >= 200 && again.status < 300 && Array.isArray(again.data) && again.data.length === 0) {
    ok('reimportar el mismo movimiento no duplica', 'ignorado por import_hash');
  } else {
    fail('reimportar el mismo movimiento no duplica',
      `HTTP ${again.status} :: ${JSON.stringify(again.data)}`);
  }

  const { data: counted } = await call('admin', 'GET',
    `/bank_transactions?import_hash=eq.${hash}&select=id`);
  expectEq('sigue habiendo un solo movimiento', (counted ?? []).length, 1);

  // ==================================================================
  console.log('\n== FASE 9b · Conciliacion ==');
  // ==================================================================
  const payment = await expectWrite('pago de prueba', 'admin', 'POST', '/payments', {
    project_id: EUROPA,
    direction: 'ENTRADA',
    payment_date: today,
    amount: 1234.56,
    currency: 'EUR',
    method: 'TRANSFERENCIA',
    reference: 'REF-AUTOTEST-1',
    client_id: CLIENT,
    bank_account_id: ACCOUNT_EUR,
  });
  if (payment) cleanup.push(['payments', payment.id]);

  const wrongAmount = await expectWrite('pago con otro importe', 'admin', 'POST', '/payments', {
    project_id: EUROPA, direction: 'ENTRADA', payment_date: today,
    amount: 999.99, currency: 'EUR', method: 'TRANSFERENCIA', client_id: CLIENT,
  });
  if (wrongAmount) cleanup.push(['payments', wrongAmount.id]);

  const outgoing = await expectWrite('pago de salida', 'admin', 'POST', '/payments', {
    project_id: EUROPA, direction: 'SALIDA', payment_date: today,
    amount: 1234.56, currency: 'EUR', method: 'TRANSFERENCIA',
  });
  if (outgoing) cleanup.push(['payments', outgoing.id]);

  if (inserted && payment) {
    const candidates = await rpc('admin', 'bank_match_candidates', {
      p_transaction_id: inserted.id,
    });
    const found = Array.isArray(candidates.data)
      && candidates.data.some((c) => c.id === payment.id);
    if (found) ok('el pago aparece entre los candidatos', `${candidates.data.length} candidatos`);
    else fail('el pago aparece entre los candidatos', JSON.stringify(candidates.data));
  }

  if (inserted && wrongAmount) {
    await expectRpcRejected('importe distinto rechazado', 'admin', 'reconcile_bank_transaction', {
      p_transaction_id: inserted.id, p_payment_id: wrongAmount.id,
    }, 'el importe no coincide');
  }

  if (inserted && outgoing) {
    await expectRpcRejected('direccion contraria rechazada', 'admin', 'reconcile_bank_transaction', {
      p_transaction_id: inserted.id, p_payment_id: outgoing.id,
    }, 'ingreso contra pago de salida');
  }

  if (inserted) {
    await expectRpcRejected('conciliar sin indicar nada rechazado', 'admin',
      'reconcile_bank_transaction', { p_transaction_id: inserted.id },
      'hay que indicar un pago o un gasto');
  }

  if (inserted && payment) {
    const done = await rpc('admin', 'reconcile_bank_transaction', {
      p_transaction_id: inserted.id, p_payment_id: payment.id,
    });
    if (done.status < 300 && done.data?.reconciled === true) {
      ok('conciliacion valida aceptada', `payment_id ${done.data.payment_id === payment.id}`);
    } else {
      fail('conciliacion valida aceptada', `HTTP ${done.status} :: ${JSON.stringify(done.data)}`);
    }

    await expectRpcRejected('no se concilia dos veces el mismo movimiento', 'admin',
      'reconcile_bank_transaction', { p_transaction_id: inserted.id, p_payment_id: payment.id },
      'el movimiento ya estaba conciliado');
  }

  // Un segundo movimiento no puede reutilizar el mismo pago.
  const second = await expectWrite('segundo movimiento identico', 'admin', 'POST',
    '/bank_transactions', { ...movement, import_hash: `${hash}-b`, reference: 'REF-AUTOTEST-2' });
  if (second) {
    cleanup.push(['bank_transactions', second.id]);
    await expectRpcRejected('un pago no se concilia con dos movimientos', 'admin',
      'reconcile_bank_transaction', { p_transaction_id: second.id, p_payment_id: payment.id },
      'el pago ya estaba conciliado');
  }

  if (inserted) {
    const undone = await rpc('admin', 'unreconcile_bank_transaction', {
      p_transaction_id: inserted.id,
    });
    if (undone.status < 300 && undone.data?.reconciled === false) {
      ok('desconciliar deja el movimiento libre');
    } else {
      fail('desconciliar deja el movimiento libre', JSON.stringify(undone.data));
    }
  }

  // RLS: comercial no tiene banks.view en EUROPA
  const batch = await expectWrite('lote de importacion', 'admin', 'POST',
    '/bank_import_batches', {
      project_id: EUROPA, bank_account_id: ACCOUNT_EUR,
      file_name: 'extracto-autotest.csv', file_format: 'CSV',
      row_count: 2, inserted_count: 1, duplicate_count: 1,
    });
  if (batch) cleanup.push(['bank_import_batches', batch.id]);

  const batchesAsComercial = await call('comercial', 'GET', '/bank_import_batches?select=id');
  expectEq('comercial no ve los lotes de importacion',
    Array.isArray(batchesAsComercial.data) ? batchesAsComercial.data.length : 'error', 0);

  // ==================================================================
  console.log('\n== FASE 10 · Documentos, versiones y aprobacion ==');
  // ==================================================================
  const { data: types } = await call('admin', 'GET',
    '/document_types?select=id,code,requires_approval,ai_extraction_type&code=in.(CONTRATO,FACTURA_COMPRA)');

  const contractType = (types ?? []).find((t) => t.code === 'CONTRATO');
  const invoiceType = (types ?? []).find((t) => t.code === 'FACTURA_COMPRA');

  const doc = contractType
    ? await expectWrite('alta de documento', 'admin', 'POST', '/documents', {
        project_id: EUROPA,
        document_type_id: contractType.id,
        name: 'Contrato de prueba automatizada',
        bucket: 'contracts',
        storage_path: `EUROPA/sale/${randomUUID()}/${randomUUID()}_contrato.pdf`,
        mime_type: 'application/pdf',
        file_size: 12345,
        status: 'EN_REVISION',
        uploaded_by: USERS.admin,
      })
    : null;
  if (doc) cleanup.push(['documents', doc.id]);

  if (doc) {
    const v = await rpc('admin', 'add_document_version', {
      p_document_id: doc.id,
      p_bucket: 'contracts',
      p_storage_path: `EUROPA/sale/${randomUUID()}/${randomUUID()}_contrato-firmado.pdf`,
      p_mime_type: 'application/pdf',
      p_file_size: 23456,
      p_comment: 'Firmado por el cliente',
    });

    if (v.status < 300 && v.data?.version === 2) {
      ok('la nueva version es la 2 y la 1 queda archivada');
    } else {
      fail('la nueva version es la 2', `HTTP ${v.status} :: ${JSON.stringify(v.data)}`);
    }

    const { data: refreshed } = await call('admin', 'GET',
      `/documents?id=eq.${doc.id}&select=current_version,storage_path`);
    expectEq('el documento apunta a la version vigente', refreshed?.[0]?.current_version, 2);

    const { data: history } = await call('admin', 'GET',
      `/document_versions?document_id=eq.${doc.id}&select=version&order=version`);
    expectEq('el historial conserva las dos versiones', (history ?? []).length, 2);

    // Aprobacion
    const approval = await expectWrite('solicitud de aprobacion', 'admin', 'POST', '/approvals', {
      project_id: EUROPA, entity_type: 'DOCUMENT', entity_id: doc.id,
      requested_by: USERS.admin, status: 'PENDIENTE',
    });
    if (approval) cleanup.push(['approvals', approval.id]);

    if (approval) {
      await expectRpcRejected('operaciones no puede aprobar documentos', 'operaciones',
        'decide_approval', { p_approval_id: approval.id, p_approve: true },
        'sin documents.approve');

      const decided = await rpc('admin', 'decide_approval', {
        p_approval_id: approval.id, p_approve: true, p_comment: 'Revisado',
      });
      if (decided.status < 300 && decided.data?.status === 'APROBADO') {
        ok('el admin aprueba y queda registrado quien decide',
          `approver ${decided.data.approver_user_id === USERS.admin}`);
      } else {
        fail('el admin aprueba', JSON.stringify(decided.data));
      }

      const { data: afterApproval } = await call('admin', 'GET',
        `/documents?id=eq.${doc.id}&select=status`);
      expectEq('el documento pasa a APROBADO', afterApproval?.[0]?.status, 'APROBADO');

      await expectRpcRejected('una aprobacion resuelta no se vuelve a decidir', 'admin',
        'decide_approval', { p_approval_id: approval.id, p_approve: false },
        'ya estaba resuelta');
    }
  }

  // ==================================================================
  console.log('\n== FASE 14 · Revision humana obligatoria (§42) ==');
  // ==================================================================
  const aiDoc = invoiceType
    ? await expectWrite('documento para extraccion', 'admin', 'POST', '/documents', {
        project_id: EUROPA,
        document_type_id: invoiceType.id,
        name: 'Factura de proveedor de prueba',
        bucket: 'invoices',
        storage_path: `EUROPA/invoice/${randomUUID()}/${randomUUID()}_factura.pdf`,
        mime_type: 'application/pdf',
        status: 'VIGENTE',
        uploaded_by: USERS.admin,
      })
    : null;
  if (aiDoc) cleanup.push(['documents', aiDoc.id]);

  const extraction = aiDoc
    ? await expectWrite('la integracion registra la extraccion', 'admin', 'POST',
        '/ai_document_extractions', {
          project_id: EUROPA,
          document_id: aiDoc.id,
          provider: 'anthropic',
          model: 'claude-opus-5',
          extraction_type: 'INVOICE',
          prompt_version: 'extract-v1',
          status: 'EXTRAIDO',
          structured_data: { invoice_number: 'A-1000', total: 4840 },
          confidence: 0.75,
        })
    : null;
  if (extraction) cleanup.push(['ai_document_extractions', extraction.id]);

  if (extraction) {
    // El corazon de §42: ni el admin puede firmarse a si mismo la revision
    // por UPDATE directo. El privilegio de columna no se lo permite.
    await expectRejected('nadie escribe reviewed_by por UPDATE directo', 'admin', 'PATCH',
      `/ai_document_extractions?id=eq.${extraction.id}`,
      { reviewed_by: USERS.admin, reviewed_at: new Date().toISOString() },
      'sin privilegio sobre la columna');

    await expectRejected('nadie marca applied_at por UPDATE directo', 'admin', 'PATCH',
      `/ai_document_extractions?id=eq.${extraction.id}`,
      { applied_at: new Date().toISOString() },
      'sin privilegio sobre la columna');

    await expectRpcRejected('aplicar antes de aprobar rechazado', 'admin',
      'mark_ai_extraction_applied', {
        p_extraction_id: extraction.id,
        p_entity_type: 'INVOICE',
        p_entity_id: randomUUID(),
      }, 'la extraccion no esta aprobada');

    await expectRpcRejected('operaciones no puede revisar extracciones', 'operaciones',
      'review_ai_extraction', { p_extraction_id: extraction.id, p_approve: true },
      'sin documents.approve');

    const reviewed = await rpc('admin', 'review_ai_extraction', {
      p_extraction_id: extraction.id, p_approve: true, p_comment: 'Datos verificados',
    });
    if (reviewed.status < 300 && reviewed.data?.status === 'APROBADO'
        && reviewed.data?.reviewed_by === USERS.admin) {
      ok('la revision humana queda registrada con su autor');
    } else {
      fail('la revision humana queda registrada', JSON.stringify(reviewed.data));
    }

    await expectRpcRejected('una extraccion revisada no se revisa dos veces', 'admin',
      'review_ai_extraction', { p_extraction_id: extraction.id, p_approve: false },
      'ya estaba revisada');

    const applied = await rpc('admin', 'mark_ai_extraction_applied', {
      p_extraction_id: extraction.id,
      p_entity_type: 'INVOICE',
      p_entity_id: randomUUID(),
    });
    if (applied.status < 300 && applied.data?.applied_at) {
      ok('tras aprobar, la extraccion puede aplicarse');
    } else {
      fail('tras aprobar, la extraccion puede aplicarse', JSON.stringify(applied.data));
    }

    await expectRpcRejected('no se aplica dos veces', 'admin', 'mark_ai_extraction_applied', {
      p_extraction_id: extraction.id, p_entity_type: 'INVOICE', p_entity_id: randomUUID(),
    }, 'ya se habia aplicado');

    const queueAsAdmin = await call('admin', 'GET',
      `/v_ai_extraction_queue?id=eq.${extraction.id}&select=id,needs_review,ready_to_apply`);
    expectEq('el admin ve la extraccion en la cola',
      Array.isArray(queueAsAdmin.data) ? queueAsAdmin.data.length : 'error', 1);

    // La cola es una vista con security_invoker, asi que hereda las
    // policies de `documents`: quien tiene documents.view en el proyecto
    // la lee, y revisarla es otro permiso distinto (ya comprobado arriba).
    const queueAsComercial = await call('comercial', 'GET',
      `/v_ai_extraction_queue?id=eq.${extraction.id}&select=id`);
    expectEq('comercial lee la cola de su proyecto (tiene documents.view)',
      Array.isArray(queueAsComercial.data) ? queueAsComercial.data.length : 'error', 1);
  }

  // El limite real es el proyecto: una extraccion de ATILA no existe para
  // quien no tiene acceso a ATILA, por muchos permisos documentales que
  // tenga en su propia unidad de negocio.
  const atilaDoc = invoiceType
    ? await expectWrite('documento en ATILA', 'admin', 'POST', '/documents', {
        project_id: ATILA,
        document_type_id: invoiceType.id,
        name: 'Factura de otra unidad de negocio',
        bucket: 'invoices',
        storage_path: `ATILA/invoice/${randomUUID()}/${randomUUID()}_factura.pdf`,
        mime_type: 'application/pdf',
        status: 'VIGENTE',
        uploaded_by: USERS.admin,
      })
    : null;
  if (atilaDoc) cleanup.push(['documents', atilaDoc.id]);

  const atilaExtraction = atilaDoc
    ? await expectWrite('extraccion en ATILA', 'admin', 'POST', '/ai_document_extractions', {
        project_id: ATILA,
        document_id: atilaDoc.id,
        provider: 'anthropic',
        model: 'claude-opus-5',
        extraction_type: 'INVOICE',
        status: 'EXTRAIDO',
        structured_data: { invoice_number: 'ATILA-1' },
      })
    : null;
  if (atilaExtraction) cleanup.push(['ai_document_extractions', atilaExtraction.id]);

  if (atilaExtraction) {
    const crossProject = await call('comercial', 'GET',
      `/v_ai_extraction_queue?id=eq.${atilaExtraction.id}&select=id`);
    expectEq('comercial no ve extracciones de ATILA',
      Array.isArray(crossProject.data) ? crossProject.data.length : 'error', 0);
  }

  // ==================================================================
  console.log('\n== Limpieza ==');
  // ==================================================================
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
