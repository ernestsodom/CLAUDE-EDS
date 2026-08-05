# Arquitectura de Software — LicitIA

## 1. Visión general

Arquitectura limpia sobre Next.js App Router, con separación estricta por capas y el patrón Repository. Todo el estado vive en Supabase (PostgreSQL + Storage); la aplicación en Vercel es stateless, lo que permite escalar horizontalmente sin coordinación.

```
┌────────────────────────────── Vercel ──────────────────────────────┐
│  Presentación   Server Components (RSC) + Client Components         │
│                 React Query · Tailwind · shadcn/ui                  │
│  ─────────────────────────────────────────────────────────────────  │
│  API            Route Handlers (/api/*) · Server Actions            │
│                 withErrorHandling · Zod validation · SSE streaming  │
│  ─────────────────────────────────────────────────────────────────  │
│  Aplicación     core/services/*  (ingesta, RAG, chat, comparación,  │
│                 reclamos, export, auditoría)                        │
│  ─────────────────────────────────────────────────────────────────  │
│  Dominio        core/domain/types · core/ai/schemas (contratos IA)  │
│  ─────────────────────────────────────────────────────────────────  │
│  Datos          core/repositories/* → Supabase JS (RLS on)          │
│                 admin client (service_role) SOLO pipeline interno   │
└────────────────────────────────────────────────────────────────────┘
          │                          │                      │
          ▼                          ▼                      ▼
   Supabase Postgres           Supabase Storage         OpenAI API
   (pgvector, tsvector,        (bucket documents,      (GPT-5.x, embeddings,
    RLS, funciones RPC)         bucket exports)         OCR por visión)
```

### Reglas de dependencia

- La presentación no habla con Supabase para escrituras complejas: pasa por API Routes.
- Los servicios no conocen HTTP; los route handlers no conocen SQL.
- El cliente `service_role` (bypass RLS) solo se importa desde `core/services/*` que corren en `/api/internal/*` o tareas de background; nunca desde componentes.

## 2. Pipeline de ingesta

`POST /api/documents/upload` crea registros y sube el binario a Storage; luego dispara (fire-and-forget con secreto interno) `POST /api/internal/process` (maxDuration 300 s):

```
descarga → extracción de texto ──(escaneado?)──► OCR (visión OpenAI)
        → document_pages (texto por página, base de citas exactas)
        → chunking (~800 tokens, solape 120, sección detectada)
        → embeddings (lotes de 100) → document_chunks (HNSW + tsvector)
        → clasificación (Structured Outputs, modelo fast)
        → en paralelo: resumen ejecutivo · variables técnicas ·
          requerimientos · línea de tiempo  (modelo chat)
        → status=procesado
```

- Cada paso actualiza `documents.processing_step` → la UI muestra progreso real.
- Fallos marcan `status=error` con el mensaje; la ficha ofrece "reprocesar" (`/api/documents/:id/reprocess`).
- ZIP se expande en documentos hijos (`parent_document_id`) y cada uno pasa por el pipeline completo.
- **Detección de escaneado**: < 100 caracteres promedio por página ⇒ OCR automático. El OCR usa la Files API de OpenAI (sin binarios nativos, apto para serverless) con separadores `=== PÁGINA N ===` para conservar la paginación.

**Escala a miles de documentos**: el pipeline es por-documento e idempotente (delete+insert por versión); N documentos = N invocaciones independientes. Para volúmenes muy altos, el mismo endpoint interno puede invocarse desde una cola (QStash/Supabase Queues) sin cambiar el código de servicios — ver roadmap.

## 3. RAG híbrido con permisos

1. **Recuperación** — RPC `hybrid_search`: búsqueda vectorial (`vector_cosine_ops`, índice HNSW) + léxica (tsvector `spanish`, websearch syntax) fusionadas por **Reciprocal Rank Fusion** (k=60). Filtros pre-recuperación: documento(s), tipo, cliente.
2. **Autorización** — las funciones RPC son `security definer` pero validan `can_read_document()` por chunk: un usuario jamás recupera contenido de documentos no autorizados, incluso vía búsqueda semántica.
3. **Generación** — el contexto se etiqueta `[chunk_id | doc | pág. X | sección]`; el agente responde en streaming y emite al final un bloque JSON de citas + confianza (delimitador `<!--citas-->`) que el handler separa antes de persistir. Las citas siempre referencian chunks reales recuperados.
4. **Agentes** — 5 system prompts especializados (`core/ai/agents.ts`) que comparten la regla: *nunca inventar; sin contexto, decirlo*.

**Extracción estructurada**: toda salida analítica de IA (clasificación, resumen, variables, requerimientos, timeline, cumplimiento, diferencias, análisis de reclamo) usa **OpenAI Structured Outputs validado con Zod** (`core/ai/schemas.ts` + `structuredCompletion`), con retry ante fallo de parseo. El JSON estructurado se persiste en columnas tipadas + `jsonb` para búsquedas y reportes.

## 4. Modelo de datos

Ver `supabase/migrations/0001_schema.sql` (DDL completo con FKs e índices). Núcleo:

- **Tenancy**: `organizations` → `profiles` (1:1 con `auth.users`, rol admin/supervisor/usuario) → todo lo demás cuelga de la organización.
- **Documental**: `documents` (metadatos tipados + `classification jsonb`) → `document_versions` → `files` (Storage) y `document_pages` (texto por página) → `document_chunks` (embedding `vector(1536)` + `tsv` generado).
- **Análisis IA**: `document_summaries`, `technical_variables` (28 categorías), `requirements`, `timelines`/`milestones`.
- **Interacción**: `conversations`/`messages` (citas jsonb, confianza), `comparisons`/`comparison_items`, `claims`/`claim_responses`, `notes`, `tags`/`document_tags`.
- **Gobernanza**: `document_permissions` (grants por usuario), `audit_logs`, `app_settings`.

Índices críticos: HNSW sobre embeddings (recall estable a millones de chunks sin re-entrenar listas, a diferencia de IVFFlat), GIN sobre `tsv` y trigram sobre títulos/nombres, B-tree sobre FKs y columnas de filtro (tipo, estado, fecha, número de licitación).

## 5. Seguridad

- **AuthN**: Supabase Auth (JWT en cookies httpOnly gestionadas por `@supabase/ssr`); `middleware.ts` refresca sesión y protege todas las rutas.
- **AuthZ**: RLS en **todas** las tablas (`0003_rls.sql`). Modelo: admin/supervisor ven su organización completa; `usuario` solo documentos propios o con grant en `document_permissions`. Conversaciones privadas por usuario. Storage con políticas por prefijo de organización.
- **Defensa en profundidad**: la misma regla (`can_read_document`) gobierna consultas directas, RPCs de búsqueda y el RAG — un solo punto de verdad.
- **Secretos**: service_role y OpenAI solo en variables de servidor; `/api/internal/*` exige `INTERNAL_API_SECRET`; validación de env con Zod al arranque (falla rápido).
- **Auditoría**: `audit_logs` registra subida, procesamiento, chat, comparaciones y reclamos (visible solo para admin).
- **Encriptación**: TLS extremo a extremo; Supabase cifra en reposo (AES-256) Postgres y Storage.
- **Validación**: todo input de API pasa por Zod; límites de tamaño (50 MB) y extensiones permitidas en la subida; URLs de archivos firmadas (1 h) en lugar de buckets públicos.

## 6. Rendimiento

- **Server Components** por defecto (dashboard, listados, fichas) → HTML directo, sin waterfalls de cliente.
- **Streaming SSE** en el chat: primer token en pantalla en ~1 s.
- **Lazy**: tabs montan contenido solo al activarse; tablas paginadas (25/página) con `count exact` server-side.
- **Cache**: React Query (staleTime 30 s) en cliente; `dashboard_stats()` es una sola RPC en vez de N queries.
- **Embeddings en lote** (100/llamada) y chunks insertados de a 200; análisis IA profundos en `Promise.all`.
- **Costos IA**: modelo *fast* para clasificación/OCR/timeline; modelo *chat* solo para razonamiento profundo (resumen, cumplimiento, reclamos).

## 7. Manejo de errores y logging

- `AppError` jerárquico + `withErrorHandling` en cada route handler → respuestas JSON homogéneas `{error:{code,message}}` con status correcto; nada de stack traces al cliente.
- Logger estructurado JSON (`lib/logger.ts`) → consumible por Vercel Log Drains (Datadog/Axiom).
- El pipeline es resiliente: errores por documento no afectan a otros; el estado y el mensaje quedan en el registro para reintento.
