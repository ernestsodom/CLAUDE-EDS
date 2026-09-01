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

Bloqueada: requiere `mcp__Supabase__execute_sql` y `mcp__Neon__run_sql`
(o `create_project`/`create_branch` si el proyecto Neon aún no existe), que
al momento de escribir este plan no estaban disponibles. En cuanto vuelvan,
el primer paso es `mcp__Neon__list_projects` para confirmar si ya existe un
proyecto o hay que crearlo, y `mcp__Supabase__restore_project` sobre el
proyecto de LicitIA si sigue pausado.
