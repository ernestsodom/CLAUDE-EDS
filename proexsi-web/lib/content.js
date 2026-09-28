// Lectura y guardado del contenido editable del sitio.
import { DEFAULTS } from './defaults.js';
import { hasDb, sql, ensureSchema, mem } from './db.js';

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Mezcla el contenido guardado sobre los valores por defecto: así los campos nuevos del
// sitio aparecen aunque la base tenga una versión anterior.
export function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
  return out;
}

let cache = { at: 0, data: null };

export async function getContent({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < 10_000) return cache.data;
  let saved = null;
  if (hasDb()) {
    await ensureSchema();
    const rows = await sql()`select data from site_content where id = 1`;
    saved = rows[0]?.data || null;
  } else {
    saved = mem.content;
  }
  const data = merge(DEFAULTS, saved || {});
  cache = { at: Date.now(), data };
  return data;
}

export async function saveContent(data, note = 'Guardado desde el back office') {
  if (!isObj(data)) throw new Error('Contenido inválido');
  const json = JSON.stringify(data);
  if (json.length > 2_000_000) throw new Error('El contenido es demasiado grande');
  if (hasDb()) {
    await ensureSchema();
    const q = sql();
    await q`insert into site_content (id, data, updated_at) values (1, ${json}::jsonb, now())
            on conflict (id) do update set data = excluded.data, updated_at = now()`;
    await q`insert into content_history (data, note) values (${json}::jsonb, ${note})`;
    await q`delete from content_history where id not in (select id from content_history order by id desc limit 30)`;
  } else {
    mem.content = data;
    mem.history.unshift({ id: mem.history.length + 1, data, note, created_at: new Date().toISOString() });
    mem.history = mem.history.slice(0, 30);
  }
  cache = { at: 0, data: null };
}

export async function listHistory() {
  if (hasDb()) {
    await ensureSchema();
    return sql()`select id, note, created_at from content_history order by id desc limit 30`;
  }
  return mem.history.map(({ id, note, created_at }) => ({ id, note, created_at }));
}

export async function getHistory(id) {
  if (hasDb()) {
    const rows = await sql()`select data from content_history where id = ${id}`;
    return rows[0]?.data || null;
  }
  return mem.history.find(h => h.id === id)?.data || null;
}
