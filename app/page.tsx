import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { landingPath } from '@/lib/navigation';

/**
 * Raiz: lleva al usuario a su proyecto por defecto. Si no tiene acceso a
 * ninguno, a la pantalla que se lo explica.
 *
 * El destino no es siempre /dashboard: cada proyecto aterriza en su
 * primera pantalla habilitada (ATILA, por ejemplo, en Negocios).
 */
export default async function RootPage() {
  const session = await requireSession();
  const first = session.projects[0];
  if (!first) redirect('/sin-acceso');
  redirect(landingPath(first));
}
