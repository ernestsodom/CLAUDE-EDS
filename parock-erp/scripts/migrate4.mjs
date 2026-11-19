// Migración 004: empaque (display/caja), OC por cajas, visaciones y registro de correos. Idempotente.
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const S = [
  `alter table products add column if not exists upd int`,
  `alter table products add column if not exists dpb int`,
  `alter table po_lines alter column price type numeric(14,4)`,
  `alter table po_lines add column if not exists boxes numeric(12,3)`,
  `create table if not exists approvals (
     id serial primary key, doc_type text not null, doc_id int not null, doc_label text not null,
     requested_by text references users(id), requested_at timestamptz not null default now(),
     approver text references users(id), status text not null default 'pendiente',
     decided_by text references users(id), decided_at timestamptz, comment text)`,
  `create index if not exists approvals_doc on approvals(doc_type, doc_id, id desc)`,
  `create table if not exists emails (
     id serial primary key, doc_type text not null, doc_id text not null, to_addr text not null, cc text,
     subject text not null, status text not null, provider_id text, error text,
     sent_by text references users(id), sent_at timestamptz not null default now())`,
  `alter table emails alter column doc_id type text`
];
for (const s of S) await sql(s);
await sql`insert into app_config(key, value) values ('visa_rules', ${JSON.stringify({
  oc: { active: true, approver: 'marcelo' }, so: { active: false, approver: 'marcelo' }, invoice: { active: false, approver: 'marcelo' }
})}) on conflict (key) do nothing`;
// Creamy Treats: 12 unidades por display, 8 displays por caja (96 unidades)
await sql`update products set upd = 12, dpb = 8, ucj = 96 where sku = 'PM-CRT-120' and upd is null`;
console.log('Migración 004 OK');
