import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { SessionContext, SessionProject } from '@/types/database.types';

/**
 * Contexto de sesion: usuario + proyectos accesibles + rol + modulos +
 * permisos efectivos, en UNA sola llamada (RPC get_session_context).
 *
 * `cache()` de React deduplica la llamada dentro del mismo render: el
 * layout, el sidebar y la pagina la piden y solo viaja una consulta.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, projects: [] };
  }

  const { data, error } = await supabase.rpc('get_session_context');

  if (error) {
    console.error('[session] get_session_context fallo:', error.message);
    return { user: null, projects: [] };
  }

  const ctx = data as SessionContext;
  return { user: ctx?.user ?? null, projects: ctx?.projects ?? [] };
});

/** Exige sesion activa; si no la hay, redirige al login. */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.user) redirect('/login');
  return ctx;
}

/**
 * Resuelve el proyecto de la URL y verifica que el usuario tenga acceso.
 *
 * Es la puerta de entrada de toda pagina bajo /[project]. Si el codigo no
 * existe o el usuario no tiene acceso, se responde 404 en lugar de 403:
 * no se confirma la existencia de proyectos ajenos.
 */
export async function requireProject(projectCode: string): Promise<{
  session: SessionContext;
  project: SessionProject;
}> {
  const session = await requireSession();
  const project = session.projects.find(
    (p) => p.code.toLowerCase() === projectCode.toLowerCase(),
  );

  if (!project) {
    const fallback = session.projects[0];
    if (!fallback) redirect('/sin-acceso');
    redirect(`/${fallback.code}/dashboard`);
  }

  return { session, project };
}
