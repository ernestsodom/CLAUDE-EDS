// Acceso a la base de datos Neon. Sin DATABASE_URL (desarrollo local) usa un almacén en memoria.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
let _sql = null;

export function hasDb() { return Boolean(url); }

export function sql() {
  if (!url) throw new Error('DATABASE_URL no está configurada');
  if (!_sql) _sql = neon(url);
  return _sql;
}

let initialized = false;
export async function ensureSchema() {
  if (!url || initialized) return;
  const q = sql();
  await q`create table if not exists site_content (id int primary key default 1, data jsonb not null, updated_at timestamptz not null default now())`;
  await q`create table if not exists content_history (id serial primary key, data jsonb not null, note text, created_at timestamptz not null default now())`;
  await q`create table if not exists images (id serial primary key, name text, mime text not null, data bytea not null, size int, created_at timestamptz not null default now())`;
  await q`create table if not exists events (id bigserial primary key, ts timestamptz not null default now(), type text not null, path text, section text, label text, visitor text, session text, referrer text, source text, utm_source text, utm_medium text, utm_campaign text, device text, browser text, country text, city text)`;
  await q`create table if not exists leads (id serial primary key, ts timestamptz not null default now(), nombre text, cargo text, institucion text, correo text, producto text, mensaje text, source text)`;
  initialized = true;
}

// ---------- Almacén en memoria para desarrollo local ----------
export const mem = globalThis.__proexsiMem || (globalThis.__proexsiMem = {
  content: null, history: [], images: [], events: [], leads: [],
});
