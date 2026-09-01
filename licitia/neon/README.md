# Migración de LicitIA: Supabase → Neon

Estado a 1 de septiembre de 2026. Este directorio contiene la parte de la
migración que ya está hecha y verificada, y el plan del resto con el
alcance medido sobre el código real, no estimado.

---

## Lo que ya está listo y verificado

**`01_schema.sql`** — el esquema completo de LicitIA listo para aplicar en un
PostgreSQL vacío, sin ninguna pieza de Supabase.

Se obtuvo aplicando las 15 migraciones de `supabase/migrations/` sobre un
PostgreSQL 16 limpio y volcando el resultado, así que es el esquema real y
no una transcripción a mano. Verificado sobre una base vacía:

| | |
|---|---|
| Tablas | 35 |
| Políticas RLS | 65 |
| Triggers | 10 |
| Índices | 96 |
| Extensiones | `vector`, `pg_trgm`, `uuid-ossp`, `pgcrypto`, `citext` |

Neon soporta las cinco extensiones, incluida `pgvector`, que es la que hace
posible la búsqueda semántica sobre los documentos.

**`00_compat_auth.sql`** (incluido al inicio de `01_schema.sql`) — la única
pieza que Supabase aportaba y Neon no trae: el esquema `auth`.

Las 65 políticas RLS se apoyan en 22 llamadas a `auth.uid()`. En Supabase ese
valor salía del JWT que PostgREST publicaba en cada petición. En Neon no hay
PostgREST: la aplicación abre la conexión, así que es ella la que declara de
quién es la sesión al abrir cada transacción:

```sql
select set_config('app.user_id', $1, true);   -- true = solo esta transacción
```

`local = true` es deliberado: con un pool de conexiones, un valor de sesión
se filtraría a la siguiente petición que reutilice esa conexión, y un usuario
acabaría viendo los datos de otro.

Con eso, **las 65 políticas siguen siendo la frontera de seguridad real y no
hay que reescribir ninguna**. Comprobado: `auth.uid()` devuelve el UUID
fijado, y el esquema entero aplica sin errores sobre PostgreSQL vanilla.

---

## Lo que falta, con el alcance medido

Sobre 113 archivos de `src/`:

| Área | Archivos | Qué implica |
|---|---|---|
| **Acceso a datos** | 45 | Usan `supabase.from(...)`, el query builder de supabase-js. Neon es PostgreSQL puro: no existe ese builder. Hay que sustituirlo por SQL con `@neondatabase/serverless`, o por un cliente que hable Postgres directo. |
| **Autenticación** | 10 | `signInWithPassword`, `auth.getUser()` en middleware, layout y 5 componentes. `profiles.id` referencia `auth.users(id)`. Sustituto: Neon Auth (Better Auth gestionado), que el conector ya expone. |
| **Almacenamiento** | 7 | Buckets `documents` y `attachments` (los PDF de las licitaciones, hasta 50 MB). Además hay subida directa desde el navegador con URL firmada. Sustituto: Neon Object Storage o Vercel Blob. Los archivos ya subidos hay que copiarlos. |

### Fases

1. **Base de datos** — esquema listo (este directorio). Falta crear el proyecto
   Neon, aplicarlo y copiar los datos existentes.
2. **Capa de datos** — reescribir los 45 archivos que consultan por
   `supabase.from()`. Es el grueso del trabajo.
3. **Autenticación** — Neon Auth, migrar las identidades y reescribir login,
   middleware y sesión.
4. **Almacenamiento** — mover los archivos de los dos buckets y reescribir
   subida y descarga.
5. **Despliegue** — variables de entorno en Vercel, verificación extremo a
   extremo y retirada de las claves de Supabase.

### Cómo aplicar el esquema cuando exista el proyecto Neon

```bash
psql "$NEON_DATABASE_URL" -f licitia/neon/01_schema.sql
```

---

## Un apunte sobre por qué esta migración no es un cambio de cadena de conexión

LicitIA no usa Supabase solo como base de datos: usa su autenticación, su
almacenamiento de archivos y su capa PostgREST. Neon es PostgreSQL gestionado
—excelente— pero esas tres cosas hay que reemplazarlas, no reconfigurarlas.

La buena noticia es que la parte más delicada, el modelo de permisos, se
conserva íntegro: 65 políticas que ya estaban probadas siguen aplicando tal
cual gracias a la capa de compatibilidad.
