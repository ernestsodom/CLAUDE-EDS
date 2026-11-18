// Migración 002: roles y permisos, CRM en tablas, reservas por línea de OC.
// Idempotente y no destructiva. Uso: DATABASE_URL=... node scripts/migrate.mjs
import { neon } from '@neondatabase/serverless';
import { ALL_PERMS } from '../lib/perms.js';

const sql = neon(process.env.DATABASE_URL);
const S = [
  `create table if not exists roles (
     id serial primary key, name text not null unique, description text,
     perms jsonb not null default '{}', system boolean not null default false,
     created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `alter table users add column if not exists email text`,
  `alter table users add column if not exists role_id int references roles(id)`,
  `alter table users add column if not exists last_login timestamptz`,
  `alter table po_lines add column if not exists reserved int not null default 0`,
  `create table if not exists crm_opportunities (
     id serial primary key, name text not null, stage text not null default 'prospecto', value text,
     owner text references users(id), note text,
     created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists crm_activities (
     id serial primary key, at date not null, time text, kind text not null, target text not null,
     description text, owner text references users(id), status text not null default 'Pendiente',
     created_at timestamptz not null default now(), updated_at timestamptz not null default now())`
];
for (const s of S) await sql(s);

const [{ n }] = await sql`select count(*)::int n from roles`;
if (!n) {
  const all = ALL_PERMS;
  const except = (...k) => Object.fromEntries(Object.entries(all).filter(([m]) => !k.includes(m)));
  const ro = m => ['ver'];
  const ROLES = [
    ['Administrador', 'Acceso total, incluida la gestión de usuarios y roles', all, true],
    ['Gerencia', 'Acceso total a la operación y finanzas, sin administración del sistema', except('admin'), false],
    ['Comercial', 'Clientes, CRM, OC y forecast. Sin costos, márgenes ni finanzas', {
      inicio: ['ver'], crm: ['ver', 'crear', 'editar', 'eliminar'], productos: ro(), precios: ['ver', 'editar'],
      oc: ['ver', 'crear', 'editar', 'eliminar', 'aprobar'], despachos: ro(), inventario: ro(),
      forecast: ['ver', 'editar'], abastecimiento: ro(), facturas: ro() }, false],
    ['Operaciones', 'Despachos, inventario y abastecimiento', {
      inicio: ['ver'], productos: ro(), oc: ['ver', 'editar'], despachos: ['ver', 'crear', 'editar', 'eliminar'],
      inventario: ['ver', 'editar', 'importar'], forecast: ro(), abastecimiento: ro() }, false]
  ];
  for (const [name, d, p, sys] of ROLES) await sql`insert into roles(name, description, perms, system) values (${name}, ${d}, ${JSON.stringify(p)}, ${sys})`;
}
await sql`update users set role_id = (select id from roles where name = 'Administrador') where role_id is null and admin`;
await sql`update users set role_id = (select id from roles where name = 'Comercial') where role_id is null`;

// CRM: mover pipeline y actividades desde app_config a tablas
const [{ o }] = await sql`select count(*)::int o from crm_opportunities`;
if (!o) {
  const [cfg] = await sql`select value from app_config where key = 'pipeline'`;
  for (const col of cfg?.value || []) for (const it of col.items)
    await sql`insert into crm_opportunities(name, stage, value, owner, note) values (${it.n}, ${col.st}, ${it.v}, ${it.o}, ${it.d || null})`;
}
const [{ a }] = await sql`select count(*)::int a from crm_activities`;
if (!a) {
  const [cfg] = await sql`select value from app_config where key = 'activities'`;
  for (const r of cfg?.value || []) {
    const [d, t] = r[0].split(' ');
    const iso = d.split('-').reverse().join('-');
    await sql`insert into crm_activities(at, time, kind, target, description, owner, status) values (${iso}, ${t || null}, ${r[1]}, ${r[2]}, ${r[3]}, ${r[4]}, ${r[5]})`;
  }
}
console.log('Migración 002 OK');
