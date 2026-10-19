import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const COOKIE = 'liga_admin';

export function token() {
  return createHash('sha256').update(`liga-manquehue:${process.env.ADMIN_PASSWORD}`).digest('hex');
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token();
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

// Categoría con la que está trabajando el administrador
export async function adminCat() {
  const v = (await cookies()).get('admin_cat')?.value;
  return v === 'senior' ? 'senior' : 'tc';
}
