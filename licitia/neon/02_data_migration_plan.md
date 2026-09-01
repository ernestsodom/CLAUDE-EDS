# Copia de datos: Supabase → Neon

Preparado mientras los conectores de Neon/Supabase estaban caídos, para no
perder tiempo derivándolo de nuevo cuando vuelvan. Procedimiento por tabla,
en el orden que exigen las claves foráneas (calculado a partir del propio
`01_schema.sql`, no a mano).

## Por qué es tabla por tabla y no un volcado

Los MCP de Neon y Supabase hablan cada uno con su propia base — no hay un
puente directo entre proveedores. El camino es: leer de Supabase con
`mcp__Supabase__execute_sql`, e insertar en Neon con `mcp__Neon__run_sql`.
Para tablas pequeñas (que es el caso esperado, LicitIA es reciente) esto es
perfectamente manejable; si alguna tabla resulta tener miles de filas, se
pagina con `limit/offset` en vez de traerla entera.

## 0. `auth.users`

Antes que nada: las 65 policies dependen de `auth.uid()`, y `profiles.id`
referencia `auth.users(id)`. Hay que copiar las identidades a la tabla
`auth.users` que crea `00_compat_auth.sql` (columnas `id`, `email` — es un
subconjunto deliberado, ver el comentario en ese archivo).

```sql
-- Supabase (leer)
select id, email from auth.users order by created_at;
```

```sql
-- Neon (escribir, una fila por usuario)
insert into auth.users (id, email) values ($1, $2)
on conflict (id) do nothing;
```

La contraseña **no se copia**: la gestionará el proveedor de autenticación
de la fase 3 (Neon Auth). Cada usuario necesitará fijar una contraseña
nueva, o se le invita de nuevo — se decide en la fase 3, no aquí.

## 1–35. Tablas de negocio, en este orden

```
1.  organizations
2.  clients
3.  profiles
4.  projects
5.  documents
6.  ai_usage_log
7.  app_settings
8.  audit_logs
9.  checklist_comparisons
10. claims
11. claim_responses
12. comparison_folders
13. comparisons
14. requirements
15. comparison_items
16. conversations
17. conversation_tags
18. delivered_items
19. document_versions
20. document_chunks
21. document_metadata
22. document_pages
23. document_permissions
24. document_summaries
25. tags
26. document_tags
27. files
28. messages
29. timelines
30. milestones
31. notes
32. note_attachments
33. systems
34. system_features
35. technical_variables
```

Para cada tabla:

1. `mcp__Supabase__execute_sql`: `select * from public.<tabla> order by created_at` (o `id`
   si no hay `created_at`). Si la tabla pudiera ser grande, paginar de 500
   en 500 con `limit/offset`.
2. Generar el `insert into public.<tabla> (...) values (...), (...), ...`
   con las columnas devueltas, respetando tipos (uuid, timestamptz, jsonb,
   arrays, `vector` en `document_chunks` — este último columna por columna,
   no como texto).
3. `mcp__Neon__run_sql`: ejecutar el insert. Usar `on conflict (id) do
   nothing` para que el proceso sea repetible si algo falla a mitad y hay
   que reintentar.
4. Verificar: `select count(*) from <tabla>` en ambos lados debe coincidir.

## Después de copiar

1. Poner en secuencia las columnas `serial`/`identity` si las hubiera
   (revisar `\d` de cada tabla — el volcado de `01_schema.sql` no mostró
   ninguna, todas las PK son `uuid`, así que este paso probablemente no
   aplica, pero conviene comprobarlo antes de dar la fase por cerrada).
2. Ejecutar el archivo de verificación de conteos por tabla y comparar
   contra los números que reporte Supabase antes de tocar nada más.
3. **No pausar ni borrar el proyecto Supabase de LicitIA todavía.** Sirve de
   respaldo y de referencia para comparar hasta que las fases 3 (auth) y 4
   (storage) estén termindas y verificadas en producción.

## Estado de esta fase

**Esquema aplicado y verificado.** Proyecto Neon `licitia`
(`polished-firefly-39510970`, org `org-broad-leaf-70071888`, Postgres 17,
us-east-1), base de datos `licitia`. Verificado contra el mismo esquema de
referencia: 35 tablas, 65 policies, 10 triggers, 96 índices, 70 FK, 5
extensiones (incluida `pgvector`). `auth.uid()` probado de verdad: resuelve
dentro de la transacción y devuelve `null` en una llamada nueva — la
identidad no se filtra entre peticiones.

`mcp__Neon__run_sql` no admite varias sentencias en una sola llamada
("cannot insert multiple commands into a prepared statement"); se usó
`mcp__Neon__run_sql_transaction` con un array de sentencias, ejecutado en
9 tandas (compat + tipos, funciones con `check_function_bodies = false`,
tablas, PK/UNIQUE, índices, triggers, FK, dos tandas de policies).

## Copia de datos: COMPLETADA Y VERIFICADA

Se descartó el plan original (leer con `execute_sql`, insertar con
`run_sql`, tabla por tabla a través de mi contexto) en cuanto se vio el
tamaño real de `document_chunks`: 2066 filas con `vector(1536)` cada una.
Traer eso a mi contexto habría sido carísimo e innecesario.

**Se usó `postgres_fdw` en Supabase apuntando directo a Neon** (host directo,
sin el pooler — el FDW necesita una conexión persistente, y pgbouncer en modo
transacción rompe el protocolo que usa internamente):

1. `create extension postgres_fdw` (+ `citext`, que Neon usa en `auth.users.email`
   y no estaba instalada en Supabase — sin ella, `IMPORT FOREIGN SCHEMA` fallaba).
2. `create server` + `create user mapping` con el rol `licitia_owner` de Neon.
3. `import foreign schema public` (35 tablas) e `import foreign schema auth
   limit to (users)`.
4. `insert into <foránea> (columnas...) select columnas... from <local>` por
   tabla, **siempre con lista de columnas explícita en ambos lados** — un primer
   intento con `select *` falló porque el orden físico de columnas no coincidía
   entre el Supabase real y el esquema aplicado en Neon (mismo set de columnas,
   orden distinto), y eso hace que `select *` posicional mande valores a la
   columna equivocada. Con nombres explícitos el orden deja de importar.

Dos obstáculos reales, ya resueltos:

- **`audit_logs.id` es `GENERATED ALWAYS AS IDENTITY`**: postgres_fdw no puede
  empujarle un valor explícito a una identity ALWAYS. Se resolvió con una
  tabla foránea auxiliar que expone solo las columnas no-identity; Neon generó
  sus propios ids (no hay ninguna FK que dependa de `audit_logs.id`).
- **Límite de 60s por llamada**: `document_chunks` (2066 filas) y
  `document_pages` (1242 filas, texto OCR) no entraban en una sola llamada.
  Se dividieron en lotes de 400-500 por `id`. Importante: la herramienta
  reportó "timed out" varias veces, pero la consulta seguía corriendo y
  confirmando datos en Neon del lado del servidor — cada vez se verificó el
  conteo real en Neon antes de decidir si reintentar o seguir.

**Resultado, tabla por tabla, Neon == Supabase en las 36:**

| Tabla | Filas | | Tabla | Filas |
|---|---|---|---|---|
| auth.users | 1 | | document_versions | 34 |
| organizations | 1 | | document_chunks | 2066 |
| clients | 21 | | document_metadata | 0 |
| profiles | 1 | | document_pages | 1242 |
| projects | 7 | | document_permissions | 0 |
| documents | 22 | | document_summaries | 29 |
| ai_usage_log | 362 | | tags | 3 |
| app_settings | 1 | | document_tags | 0 |
| audit_logs | 188 | | files | 34 |
| checklist_comparisons | 2 | | messages | 40 |
| claims | 1 | | timelines | 13 |
| claim_responses | 1 | | milestones | 102 |
| comparison_folders | 0 | | notes | 0 |
| comparisons | 19 | | note_attachments | 0 |
| requirements | 474 | | systems | 96 |
| comparison_items | 36 | | system_features | 628 |
| conversations | 11 | | technical_variables | 179 |
| conversation_tags | 0 | | | |
| delivered_items | 15 | | | |

Total: **5.629 filas** en 35 tablas + 1 identidad.

El puente `postgres_fdw` (extensión, server, user mapping, tablas foráneas) se
desmontó de Supabase al terminar — no queda credencial de Neon almacenada ahí.

**No se pausó ni se tocó el proyecto Supabase de LicitIA.** Sigue activo como
respaldo y punto de comparación hasta que las fases 3 (auth) y 4 (storage)
estén hechas y verificadas en producción.

## Fase 3 — Autenticación (better-auth): estado

**Hecho:**
- Proveedor elegido: **better-auth**, self-hosted sobre las mismas tablas de
  Neon (`ba_user`, `ba_session`, `ba_account`, `ba_verification` —
  `03_better_auth_schema.sql`, ya aplicado). Sin cambiar ni un policy: RLS
  sigue leyendo `app.user_id` (`auth.uid()` en `00_compat_auth.sql`); lo
  único que cambió es quién decide ese id.
- `lib/auth.ts` (servidor) / `lib/auth-client.ts` (navegador) / ruta
  `app/api/auth/[...all]`.
- Contraseñas verificadas con **bcrypt** (no el scrypt por defecto de
  better-auth), para que el usuario migrado siga entrando con la misma
  contraseña que tenía en GoTrue — se copió su hash tal cual.
- `databaseHooks.user.create.after` reimplementa `handle_new_user()`
  (primer usuario de la organización → admin, resto → usuario).
- Interruptor doble, coherente con la fase 2: `DATABASE_URL` (servidor,
  `useNeon()`) y `NEXT_PUBLIC_USE_NEON` (navegador, `useNeonClient()`) —
  deben activarse juntas. Sin ellas, cero cambio de comportamiento.
- Reescritos con el interruptor: `middleware.ts` (con Neon, chequeo
  optimista de cookie vía `getSessionCookie()`, sin tocar la base de datos
  en el runtime de middleware), `lib/supabase/server.ts` (`requireUser()`),
  `app/(app)/layout.tsx`, las 8 páginas que leían `createClient()`
  directo (ahora pasan por `requireUser()`), `app/login/page.tsx` y el
  cierre de sesión en `components/app-sidebar.tsx`.
- Usuario real migrado (`ernestodom@gmail.com`) con su mismo id de
  `profiles`/`auth.users`, para no reescribir las FKs que ya apuntaban a
  ese valor.
- `npx tsc --noEmit` limpio y los 138 tests existentes (123 pasan, 15
  se saltan por falta de Postgres local) siguen en verde.

**Pendiente, fuera de esta pasada (alcance nuevo, no autorizado aún):**
Diez componentes de cliente llaman a Supabase directo desde el navegador
para leer/escribir datos —no solo para sesión— usando la anon key + RLS
(`comments-panel`, `conversation-list`, `document-picker`,
`project-picker`, `systems-checklist`, `rename-document-button`,
`claim-responses`, `move-comparison-button`, `move-to-folder-button`,
`comparison-folder-picker`). Neon no tiene un equivalente "seguro para el
navegador" a PostgREST — la capa de compatibilidad (`lib/db/query-builder.ts`)
solo corre en el servidor, con la cadena de conexión de `app_user`. Esos diez
componentes necesitan convertirse a Server Actions antes de poder activar
`NEXT_PUBLIC_USE_NEON=1` en producción; es un trabajo separado y de tamaño
comparable al de esta fase, por eso no se tocó aquí.
