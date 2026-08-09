import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';

/**
 * Raiz: lleva al usuario a su proyecto por defecto. Si no tiene acceso a
 * ninguno, a la pantalla que se lo explica.
 */
export default async function RootPage() {
  const session = await requireSession();
  const first = session.projects[0];
  if (!first) redirect('/sin-acceso');
  redirect(`/${first.code}/dashboard`);
}
