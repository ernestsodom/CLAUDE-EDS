import { betterAuth } from "better-auth";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/**
 * Autenticación sobre Neon (Fase 3 de la migración).
 *
 * Reemplaza a Supabase Auth (GoTrue). Vive en tablas propias —`ba_user`,
 * `ba_session`, `ba_account`, `ba_verification`— separadas a propósito de
 * `auth.users` (el esquema de compatibilidad de `neon/00_compat_auth.sql`,
 * que solo existe para que `auth.uid()` siga funcionando bajo las 65
 * políticas RLS). Las dos cosas están desacopladas por diseño: RLS lee
 * `app.user_id` (ver `lib/db/executor.ts`), y da igual qué sistema haya
 * decidido ese id — antes era el JWT de Supabase, ahora es la sesión de
 * better-auth. Ningún policy tuvo que tocarse.
 *
 * El id de usuario NUEVO (`ba_user.id`) se define igual al `profiles.id`/
 * `auth.users.id` existente para el único usuario real migrado, así se
 * evita reescribir las ~10 tablas que tienen una FK a `profiles.id`.
 *
 * Contraseñas: se verifican con bcrypt (compatible con el hash que ya tenía
 * GoTrue) en vez del scrypt por defecto de better-auth, para que el único
 * usuario migrado pueda seguir usando su contraseña de siempre. Los
 * usuarios nuevos también quedan en bcrypt: no hay necesidad de manejar dos
 * formatos.
 */

let instance: ReturnType<typeof buildAuth> | null = null;

function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está configurada: better-auth (Fase 3) la necesita " +
        "igual que la capa de datos (Fase 2). Debe ser la del rol `app_user`."
    );
  }
  return new Pool({ connectionString: url, max: 5 });
}

export function auth() {
  if (!instance) instance = buildAuth();
  return instance;
}

function buildAuth() {
  return betterAuth({
    database: pool(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
    user: {
      modelName: "ba_user",
    },
    session: {
      modelName: "ba_session",
      // 7 días, igual que el valor por defecto que traía Supabase Auth.
      expiresIn: 60 * 60 * 24 * 7,
    },
    account: {
      modelName: "ba_account",
    },
    verification: {
      modelName: "ba_verification",
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: (password) => bcrypt.hash(password, 10),
        verify: ({ hash, password }) => bcrypt.compare(password, hash),
      },
    },
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            // Reimplementa `handle_new_user()` (supabase/setup-completo.sql):
            // el primer usuario de la organización queda admin, el resto
            // usuario. Solo importa para altas futuras — el usuario migrado
            // ya tiene su fila en `profiles` desde antes de Neon.
            const client = await pool().connect();
            try {
              await client.query("begin");
              let { rows: orgRows } = await client.query<{ id: string }>(
                "select id from organizations order by created_at limit 1"
              );
              let orgId = orgRows[0]?.id;
              if (!orgId) {
                const inserted = await client.query<{ id: string }>(
                  "insert into organizations (name, slug) values ($1, $2) returning id",
                  ["Mi Organización", "principal"]
                );
                orgId = inserted.rows[0].id;
              }
              const { rows: countRows } = await client.query<{ count: string }>(
                "select count(*)::int as count from profiles where organization_id = $1",
                [orgId]
              );
              const role = Number(countRows[0]?.count ?? 0) === 0 ? "admin" : "usuario";
              await client.query(
                `insert into profiles (id, organization_id, email, full_name, role)
                 values ($1, $2, $3, $4, $5::user_role)
                 on conflict (id) do nothing`,
                [user.id, orgId, user.email ?? "", user.name || (user.email ?? "usuario").split("@")[0], role]
              );
              await client.query("commit");
            } catch (error) {
              await client.query("rollback").catch(() => {});
              throw error;
            } finally {
              client.release();
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof auth>;
