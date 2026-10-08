// Base de datos en memoria para probar sin conexión a Neon (no se despliega).
const db = { content: null, history: [], images: new Map(), msgs: [] };
let hid = 0, mid = 0;
globalThis.__MOCK_SQL__ = {
  async query(q, p = []) {
    q = q.replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT data, updated_at FROM site_content')) return db.content ? [{ data: JSON.parse(db.content), updated_at: new Date() }] : [];
    if (q.startsWith('INSERT INTO site_content')) { db.content = p[0]; return []; }
    if (q.startsWith('INSERT INTO site_history')) { db.history.unshift({ id: ++hid, data: p[0], saved_at: new Date() }); return []; }
    if (q.startsWith('DELETE FROM site_history')) { db.history = db.history.slice(0, 30); return []; }
    if (q.startsWith('SELECT id, saved_at FROM site_history')) return db.history.map(({ id, saved_at }) => ({ id, saved_at }));
    if (q.startsWith('SELECT data FROM site_history')) { const v = db.history.find((x) => x.id === p[0]); return v ? [{ data: JSON.parse(v.data) }] : []; }
    if (q.startsWith('INSERT INTO images')) { db.images.set(p[0], { mime: p[1], b64: p[2] }); return []; }
    if (q.startsWith('SELECT mime, encode')) { const i = db.images.get(p[0]); return i ? [i] : []; }
    if (q.startsWith('INSERT INTO contact_messages')) { db.msgs.unshift({ id: ++mid, nombre: p[0], empresa: p[1], email: p[2], mensaje: p[3], leido: false, created_at: new Date() }); return []; }
    if (q.startsWith('SELECT id, nombre')) return db.msgs;
    if (q.startsWith('UPDATE contact_messages')) { const m = db.msgs.find((x) => x.id === p[0]); if (m) m.leido = p[1]; return []; }
    if (q.startsWith('DELETE FROM contact_messages')) { db.msgs = db.msgs.filter((x) => x.id !== p[0]); return []; }
    throw new Error('Consulta no soportada en el mock: ' + q);
  }
};
