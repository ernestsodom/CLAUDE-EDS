import 'server-only';

import { createClient } from '@/lib/supabase/server';

export const DEFAULT_PAGE_SIZE = 25;

export interface ListParams {
  page?: string;
  q?: string;
  [key: string]: string | undefined;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
}

/**
 * Consulta paginada en el servidor (§78).
 *
 * Trae exactamente una pagina (`.range()`) y el total exacto (`count`).
 * El navegador nunca recibe miles de filas.
 *
 * No se filtra por project_id "por seguridad" sino por eficiencia: la
 * frontera real es RLS. Aun asi se filtra siempre, porque pedir a la base
 * lo que no se va a usar es desperdicio.
 */
export async function fetchList<T>(options: {
  from: string;
  select: string;
  projectId: string;
  params: ListParams;
  /** Columnas sobre las que aplica la busqueda libre (ILIKE). */
  searchColumns?: string[];
  /** Filtros exactos: nombre del parametro URL -> columna. */
  filters?: Record<string, string>;
  /** Filtros fijos aplicados siempre. */
  equals?: Record<string, string | number | boolean | null>;
  /** Valores que deben estar dentro de una lista. */
  ins?: Record<string, string[]>;
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  /** Excluir borrados logicos. */
  softDelete?: boolean;
}): Promise<ListResult<T>> {
  const {
    from,
    select,
    projectId,
    params,
    searchColumns = [],
    filters = {},
    equals = {},
    ins = {},
    orderBy = { column: 'created_at', ascending: false },
    pageSize = DEFAULT_PAGE_SIZE,
    softDelete = false,
  } = options;

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const offset = (page - 1) * pageSize;

  const supabase = await createClient();
  let query = supabase
    .from(from)
    .select(select, { count: 'exact' })
    .eq('project_id', projectId);

  if (softDelete) query = query.is('deleted_at', null);

  for (const [column, value] of Object.entries(equals)) {
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }

  for (const [column, values] of Object.entries(ins)) {
    query = query.in(column, values);
  }

  for (const [param, column] of Object.entries(filters)) {
    const value = params[param];
    if (value) query = query.eq(column, value);
  }

  const search = params.q?.trim();
  if (search && searchColumns.length > 0) {
    // `or` con ILIKE sobre las columnas indexadas con pg_trgm.
    const escaped = search.replace(/[%,()]/g, ' ').trim();
    if (escaped) {
      query = query.or(searchColumns.map((c) => `${c}.ilike.%${escaped}%`).join(','));
    }
  }

  query = query
    .order(orderBy.column, { ascending: orderBy.ascending ?? false, nullsFirst: false })
    .range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error(`[list:${from}]`, error.message);
    return { rows: [], total: 0, page, pageSize, error: error.message };
  }

  return {
    rows: (data ?? []) as T[],
    total: count ?? 0,
    page,
    pageSize,
    error: null,
  };
}

/** Reconstruye los parametros de la URL para conservar filtros al paginar. */
export function carryParams(params: ListParams): Record<string, string | undefined> {
  const { page: _page, ...rest } = params;
  return rest;
}
