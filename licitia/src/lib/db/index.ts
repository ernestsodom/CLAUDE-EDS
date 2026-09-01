import { createExecutor, type Executor } from "./executor";
import { QueryBuilder, type Result } from "./query-builder";

/**
 * Cliente de datos sobre Neon.
 *
 * Expone la misma superficie que se usa hoy de supabase-js —`.from()`,
 * `.rpc()`— para que las 45 pantallas y servicios que ya existen no tengan
 * que cambiar ni una línea. Lo que cambia por debajo es que no hay
 * PostgREST: se genera SQL y se ejecuta contra PostgreSQL.
 *
 * Dos formas de crearlo, con la misma distinción de siempre:
 *   - `createDbClient(userId)` ejecuta como el usuario -> **RLS aplica**.
 *   - `createAdminDbClient()` ejecuta sin identidad -> para el pipeline de
 *     ingesta y las tareas de fondo, igual que hacía el service_role.
 */

export interface DbClient {
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<Result<T>>;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está configurada. Es la cadena de conexión de Neon " +
        "del rol de aplicación (no la del dueño de las tablas: el dueño está " +
        "exento de RLS y eso desactivaría los 65 candados)."
    );
  }
  return url;
}

function client(executor: Executor, userId: string | null): DbClient {
  return {
    from<T = Record<string, unknown>>(table: string) {
      return new QueryBuilder<T>(executor, userId, table);
    },
    async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fn)) {
        return { data: null, error: { message: `Función inválida: "${fn}"` }, count: null };
      }
      // Los argumentos van por nombre, como en PostgREST: así el orden en el
      // que la aplicación los escriba deja de importar.
      const names = Object.keys(args);
      const params = names.map((n) => args[n]);
      const call = names.map((n, i) => `${n} => $${i + 1}`).join(", ");

      try {
        const { rows } = await executor.run<Record<string, unknown>>(
          `select * from ${fn}(${call})`,
          params,
          userId
        );
        return { data: rows as unknown as T, error: null, count: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { data: null, error: { message }, count: null };
      }
    },
  };
}

/** Cliente con la identidad del usuario: las políticas RLS deciden qué ve. */
export function createDbClient(userId: string, executor?: Executor): DbClient {
  return client(executor ?? createExecutor(connectionString()), userId);
}

/** Cliente sin identidad, para ingesta y tareas de fondo. */
export function createAdminDbClient(executor?: Executor): DbClient {
  return client(executor ?? createExecutor(connectionString()), null);
}

export type { Result };
export { QueryBuilder };
