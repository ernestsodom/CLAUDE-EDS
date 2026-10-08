// Se ejecuta solo durante la compilación en Cloudflare (WORKERS_CI=1), justo después de instalar dependencias.
// Traspasa al sitio los secretos guardados como variables de compilación, para que no haya que cargarlos a mano.
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

if (!process.env.WORKERS_CI) process.exit(0);
const NAMES = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const secrets = Object.fromEntries(NAMES.filter(n => process.env[n]?.trim()).map(n => [n, process.env[n].trim()]));
if (!Object.keys(secrets).length) { console.log('[secretos] No hay variables de compilación que traspasar.'); process.exit(0); }
const dir = mkdtempSync(join(tmpdir(), 'px-'));
const file = join(dir, 'secrets.json');
try {
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  console.log('[secretos] Cargando en el sitio:', Object.keys(secrets).join(', '));
  execFileSync('npx', ['wrangler', 'secret', 'bulk', file, '--name', 'proexsi-cultura'], { stdio: 'inherit' });
  console.log('[secretos] Listo.');
} catch (e) {
  console.log('[secretos] No se pudieron cargar automáticamente:', e.message);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
