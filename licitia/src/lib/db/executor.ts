import { Pool, type PoolClient } from "pg";

/**
 * Ejecución de SQL contra Neon.
 *
 * Cada consulta corre dentro de una transacción que empieza declarando de
 * quién es la sesión:
 *
 *     select set_config('app.user_id', $1, true)
 *
 * De ahí lo lee `auth.uid()` (ver `neon/00_compat_auth.sql`), que es lo que
 * evalúan las 65 políticas RLS. El tercer argumento —`local = true`— no es
 * un detalle: con un pool de conexiones, un valor de sesión sobreviviría a
 * la petición y la siguiente que reutilizara esa conexión heredaría la
 * identidad de la anterior. Con `local`, el valor muere con la transacción.
 *
 * IMPORTANTE: el rol con el que se conecta la aplicación NO debe ser el
 * dueño de las tablas. PostgreSQL exime al dueño de sus propias políticas
 * RLS, así que conectarse como dueño desactivaría en silencio los 65
 * candados. `neon/00_compat_auth.sql` crea el rol `app_user` para esto.
 */

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface Executor {
  /** Ejecuta SQL con la identidad indicada (null = sin sesión, solo service role). */
  run<T = Record<string, unknown>>(
    sql: string,
    params: unknown[],
    userId: string | null
  ): Promise<QueryResult<T>>;
  /** Varias sentencias en UNA transacción, con la misma identidad. */
  transaction<T>(userId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

let sharedPool: Pool | null = null;

function pool(connectionString: string): Pool {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString,
      // Neon corta las conexiones ociosas; un pool pequeño y con reciclado
      // rápido evita arrastrar sockets muertos entre invocaciones lambda.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return sharedPool;
}

export function createExecutor(connectionString: string): Executor {
  const p = pool(connectionString);

  async function withSession<T>(
    userId: string | null,
    fn: (c: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await p.connect();
    try {
      await client.query("begin");
      if (userId === null) {
        // Cliente admin (ingesta y tareas de fondo): `app.user_id` vacío NO
        // basta para "ver todo" — las 65 políticas RLS comparan contra
        // `auth.uid()` (que sería null) y eso hace que condiciones como
        // `organization_id = current_org_id()` sean NULL, es decir falsas:
        // CERO filas visibles, no todas. `service_role` (`00_compat_auth.sql`,
        // ya existía para la compatibilidad con Supabase) tiene `bypassrls`;
        // `app_user` puede pasar a él porque se le otorgó membresía
        // (`grant service_role to app_user`). `set local role`: el cambio,
        // como `app.user_id`, muere con la transacción — la siguiente que
        // reutilice esta conexión del pool vuelve a `app_user` sola.
        await client.query("set local role service_role");
      } else {
        // `local = true`: el valor solo vive dentro de esta transacción.
        await client.query("select set_config('app.user_id', $1, true)", [userId]);
      }
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async run(sql, params, userId) {
      return withSession(userId, async (client) => {
        const r = await client.query(sql, params);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      });
    },
    transaction: withSession,
    async end() {
      if (sharedPool) {
        await sharedPool.end();
        sharedPool = null;
      }
    },
  };
}

/** Para las pruebas: un ejecutor sobre un pool propio, sin estado compartido. */
export function createIsolatedExecutor(connectionString: string): Executor {
  const p = new Pool({ connectionString, max: 3 });

  async function withSession<T>(
    userId: string | null,
    fn: (c: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await p.connect();
    try {
      await client.query("begin");
      if (userId === null) {
        // Ver el comentario equivalente en createExecutor: sin esto, el
        // cliente admin de las pruebas vería CERO filas bajo RLS, no todas.
        await client.query("set local role service_role");
      } else {
        await client.query("select set_config('app.user_id', $1, true)", [userId]);
      }
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    async run(sql, params, userId) {
      return withSession(userId, async (client) => {
        const r = await client.query(sql, params);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      });
    },
    transaction: withSession,
    end: () => p.end(),
  };
}
