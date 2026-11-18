// Migración 003: salas por cliente, proveedores, OC a proveedor, imágenes. Idempotente y no destructiva.
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const S = [
  `alter table clients add column if not exists rooms int not null default 0`,
  `create table if not exists suppliers (
     id serial primary key, name text not null unique, rut text, country text, category text,
     contact text, phone text, mail text, term int not null default 30, currency text not null default 'CLP',
     active boolean not null default true, notes text,
     created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `alter table purchases add column if not exists supplier_id int references suppliers(id) on delete set null`,
  `create table if not exists supplier_orders (
     id serial primary key, number text not null unique, supplier_id int not null references suppliers(id),
     issued date not null default current_date, eta date, status text not null default 'borrador',
     currency text not null default 'CLP', notes text, created_by text references users(id),
     created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists supplier_order_lines (
     order_id int not null references supplier_orders(id) on delete cascade, line int not null,
     sku text not null references products(sku), qty int not null check (qty > 0), unit_cost numeric(14,2) not null default 0,
     primary key (order_id, line))`,
  `create table if not exists images (
     id serial primary key, mime text not null, data bytea not null, name text,
     created_by text references users(id), created_at timestamptz not null default now())`
];
for (const s of S) await sql(s);

// Proveedores iniciales a partir de los nombres ya usados
const [{ n }] = await sql`select count(*)::int n from suppliers`;
if (!n) {
  const names = await sql`select distinct supplier as name from products where supplier is not null and supplier <> ''
    union select distinct supplier from purchases where supplier is not null and supplier <> ''`;
  for (const { name } of names) {
    const [p] = await sql`select supplier_rut, category from purchases where supplier = ${name} limit 1`;
    const country = (name.match(/\((.+)\)/) || [])[1] || 'Chile';
    await sql`insert into suppliers(name, rut, country, category, currency) values (${name}, ${p?.supplier_rut && p.supplier_rut !== '—' ? p.supplier_rut : null}, ${country},
      ${p?.category || 'Mercadería'}, ${country === 'Chile' ? 'CLP' : 'USD'}) on conflict do nothing`;
  }
  await sql`update purchases p set supplier_id = s.id from suppliers s where s.name = p.supplier and p.supplier_id is null`;
}

// Permiso del nuevo módulo para los roles existentes
await sql`update roles set perms = perms || '{"proveedores":["ver","crear","editar","eliminar"]}'::jsonb where name in ('Administrador','Gerencia','Operaciones') and not perms ? 'proveedores'`;
await sql`update roles set perms = perms || '{"proveedores":["ver"]}'::jsonb where name = 'Comercial' and not perms ? 'proveedores'`;

// Salas de ejemplo (solo si todas están en 0)
const [{ z }] = await sql`select count(*)::int z from clients where rooms > 0`;
if (!z) {
  for (const [id, r] of [['C01', 58], ['C02', 24], ['C03', 17], ['C04', 6]]) await sql`update clients set rooms = ${r} where id = ${id}`;
}
console.log('Migración 003 OK');
