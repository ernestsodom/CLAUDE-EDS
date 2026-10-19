// Crea las tablas y carga la tabla inicial. Uso: npm run db:setup
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
for (const file of ['schema.sql', 'seed.sql']) {
  await pool.query(readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8'));
  console.log(`✔ ${file}`);
}
await pool.end();
