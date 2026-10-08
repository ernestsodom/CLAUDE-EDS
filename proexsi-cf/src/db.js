// Acceso a datos: Neon (Postgres) en producción; memoria cuando no hay DATABASE_URL (desarrollo local).
import { neon } from '@neondatabase/serverless';

const SCHEMA = [
  `create table if not exists site_content (id int primary key, data jsonb not null, updated_at timestamptz not null default now())`,
  `create table if not exists content_history (id serial primary key, data jsonb not null, note text, created_at timestamptz not null default now())`,
  `create table if not exists media (id serial primary key, name text not null, mime text not null, bytes bytea not null, size int not null, width int, height int, created_at timestamptz not null default now())`,
  `create table if not exists leads (id serial primary key, data jsonb not null, created_at timestamptz not null default now())`,
];
const KEEP_HISTORY = 40;

let ready = null;
function pg(env) {
  const sql = neon(env.DATABASE_URL);
  const q = (text, params = []) => sql.query(text, params);
  if (!ready) ready = (async () => { for (const s of SCHEMA) await q(s); })().catch(e => { ready = null; throw e; });
  return { q, ready };
}

const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/* ---- memoria (solo desarrollo) ---- */
const mem = globalThis.__pxMem || (globalThis.__pxMem = { content: null, updated: null, history: [], media: [], leads: [], seq: 1 });
const memDb = {
  kind: 'memoria',
  async getContent() { return mem.content ? { data: structuredClone(mem.content), updated_at: mem.updated } : null; },
  async saveContent(data, note) {
    mem.content = structuredClone(data); mem.updated = new Date().toISOString();
    mem.history.unshift({ id: mem.seq++, data: structuredClone(data), note, created_at: mem.updated });
    mem.history.length = Math.min(mem.history.length, KEEP_HISTORY);
    return mem.updated;
  },
  async listHistory() { return mem.history.map(({ id, note, created_at }) => ({ id, note, created_at })); },
  async getHistory(id) { return mem.history.find(h => h.id === Number(id))?.data || null; },
  async addMedia(m) { const id = mem.seq++; mem.media.push({ ...m, id, bytes: m.bytes, created_at: new Date().toISOString() }); return id; },
  async getMedia(id) { return mem.media.find(m => m.id === Number(id)) || null; },
  async listMedia() { return mem.media.map(({ bytes, ...m }) => m).reverse(); },
  async deleteMedia(id) { mem.media = mem.media.filter(m => m.id !== Number(id)); },
  async addLead(data) { mem.leads.unshift({ id: mem.seq++, data, created_at: new Date().toISOString() }); },
  async listLeads() { return mem.leads; },
  async deleteLead(id) { mem.leads = mem.leads.filter(l => l.id !== Number(id)); },
};

function pgDb(env) {
  const { q } = pg(env);
  const run = async (text, params) => { await ready; return q(text, params); };
  return {
    kind: 'neon',
    async getContent() {
      const r = await run('select data, updated_at from site_content where id = 1');
      return r[0] || null;
    },
    async saveContent(data, note) {
      const r = await run(`insert into site_content (id, data, updated_at) values (1, $1, now())
        on conflict (id) do update set data = excluded.data, updated_at = now() returning updated_at`, [JSON.stringify(data)]);
      await run('insert into content_history (data, note) values ($1, $2)', [JSON.stringify(data), note || null]);
      await run(`delete from content_history where id not in (select id from content_history order by id desc limit ${KEEP_HISTORY})`);
      return r[0].updated_at;
    },
    async listHistory() { return run('select id, note, created_at from content_history order by id desc'); },
    async getHistory(id) { const r = await run('select data from content_history where id = $1', [Number(id)]); return r[0]?.data || null; },
    async addMedia({ name, mime, bytes, width, height }) {
      const r = await run(`insert into media (name, mime, bytes, size, width, height) values ($1, $2, decode($3, 'base64'), $4, $5, $6) returning id`,
        [name, mime, bytesToB64(bytes), bytes.length, width || null, height || null]);
      return r[0].id;
    },
    async getMedia(id) {
      const r = await run(`select mime, encode(bytes, 'base64') as b64 from media where id = $1`, [Number(id)]);
      return r[0] ? { mime: r[0].mime, bytes: b64ToBytes(r[0].b64) } : null;
    },
    async listMedia() { return run('select id, name, mime, size, width, height, created_at from media order by id desc'); },
    async deleteMedia(id) { await run('delete from media where id = $1', [Number(id)]); },
    async addLead(data) { await run('insert into leads (data) values ($1)', [JSON.stringify(data)]); },
    async listLeads() { return run('select id, data, created_at from leads order by id desc limit 500'); },
    async deleteLead(id) { await run('delete from leads where id = $1', [Number(id)]); },
  };
}

export const getDb = env => (env.DATABASE_URL ? pgDb(env) : memDb);
