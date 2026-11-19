// Migración 005: logo por cliente. Idempotente.
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
await sql`alter table clients add column if not exists logo text`;
console.log('Migración 005 OK');
