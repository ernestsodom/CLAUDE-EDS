import { neon } from '@neondatabase/serverless';
import { DEFAULT_CONTENT } from '../static/defaults.js';

let _sql;
export function sql() {
  if (globalThis.__MOCK_SQL__) return globalThis.__MOCK_SQL__; // solo pruebas locales
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function getContent() {
  try {
    const rows = await sql().query('SELECT data, updated_at FROM site_content WHERE id = $1', ['main']);
    if (rows.length) return { data: rows[0].data, updatedAt: rows[0].updated_at };
  } catch (e) {
    console.error('getContent', e.message);
  }
  return { data: DEFAULT_CONTENT, updatedAt: null };
}

export async function saveContent(data) {
  const json = JSON.stringify(data);
  await sql().query(
    `INSERT INTO site_content (id, data, updated_at) VALUES ('main', $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [json]);
  await sql().query('INSERT INTO site_history (data) VALUES ($1::jsonb)', [json]);
  // conserva solo las últimas 30 versiones
  await sql().query('DELETE FROM site_history WHERE id NOT IN (SELECT id FROM site_history ORDER BY id DESC LIMIT 30)');
}
