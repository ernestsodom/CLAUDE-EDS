// Publica el Worker desde Cloudflare Workers Builds y traspasa al sitio los secretos
// guardados como variables de compilación (DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET).
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

execFileSync('node', ['scripts/static-images.mjs'], { stdio: 'inherit' });

const NAMES = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const secrets = Object.fromEntries(NAMES.filter(n => process.env[n]?.trim()).map(n => [n, process.env[n].trim()]));
const args = ['wrangler', 'deploy'];
let dir;
if (Object.keys(secrets).length) {
  dir = mkdtempSync(join(tmpdir(), 'px-'));
  const file = join(dir, 'secrets.json');
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  args.push('--secrets-file', file);
  console.log('Secretos que se cargarán en el sitio:', Object.keys(secrets).join(', '));
} else {
  console.log('No hay secretos en las variables de compilación; se publica solo el código.');
}
try {
  execFileSync('npx', args, { stdio: 'inherit' });
} finally {
  if (dir) rmSync(dir, { recursive: true, force: true });
}
