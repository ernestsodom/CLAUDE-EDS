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
   Supabase Postgres           Supabase Storage      Proveedores de IA
   (pgvector, tsvector,        (bucket documents,    (Gemini, Groq — o el
    RLS, funciones RPC)         bucket exports)       motor local sin IA)
```

### Reglas de dependencia

- La presentación no habla con Supabase para escrituras complejas: pasa por API Routes.
- Los servicios no conocen HTTP; los route handlers no conocen SQL.
- El cliente `service_role` (bypass RLS) solo se importa desde `core/services/*` que corren en `/api/internal/*` o tareas de background; nunca desde componentes.

## 2. Pipeline de ingesta por etapas

`POST /api/documents/upload` crea los registros y sube el binario a Storage, **sin disparar el análisis**: las funciones serverless tienen un límite de duración (60 s en el plan Hobby de Vercel) y no garantizan que un trabajo lanzado "en segundo plano" tras responder llegue a ejecutarse. En vez de eso, el análisis se trocea en etapas: cada llamada a `POST /api/documents/:id/process` ejecuta **un único tramo acotado** y devuelve el estado; el navegador (`lib/process-document.ts`) encadena llamadas hasta completar, mostrando el progreso real.

```
extraccion_texto → chunking → embeddings* → clasificacion → resumen
  → variables → requerimientos → timeline → completado
  (*) se repite en lotes de 120 mientras queden chunks sin vectorizar.
```

- `documents.processing_step` marca la siguiente etapa pendiente → el pipeline es **reanudable**: si una etapa falla o la pestaña se cierra, la siguiente llamada retoma ahí, sin repetir trabajo ya hecho.
- Fallos marcan `status=error` con el mensaje real del proveedor (cuota agotada, OCR no disponible con el motor elegido, etc.) — `withErrorHandling` normalmente oculta los errores tras un mensaje genérico, así que las rutas de proceso capturan la excepción y la reenvían como `AppError` para que el mensaje llegue legible a la interfaz.
- ZIP se expande en documentos hijos (`parent_document_id`); cada uno pasa por el pipeline completo por su cuenta.
- **Detección de escaneado**: < 100 caracteres promedio por página ⇒ OCR automático (hoy solo vía Gemini, único proveedor con Files API) con separadores `=== PÁGINA N ===` para conservar la paginación.
- `POST /api/internal/process` (con `processDocumentFully()`, sin trocear) sigue existiendo para entornos sin límite estricto de duración — plan Pro de Vercel o una cola externa.

**Escala a miles de documentos**: el pipeline es por-documento e idempotente (delete+insert por etapa); N documentos = N flujos de etapas independientes. Para cargas masivas, las mismas rutas por etapa pueden invocarse desde una cola (QStash/Supabase Queues) sin cambiar el código de servicios — ver roadmap.

## 2.1 Arquitectura multi-proveedor de IA

LicitIA no depende de un único proveedor de IA. `lib/ai-providers.ts` es un registro genérico sobre proveedores compatibles con la API de OpenAI; hoy incluye dos, cada uno con nivel gratuito:

| Proveedor | Uso | Embeddings | OCR (Files API) |
|---|---|---|---|
| **Gemini** | clasificación, resumen, variables, requerimientos, timeline | ✅ (`gemini-embedding-001`, 1536 dims) | ✅ |
| **Groq** (Llama) | igual que Gemini, inferencia muy rápida | ❌ | ❌ |
| **Motor local** | extracción por patrones (`heuristic.service.ts`), sin llamadas a IA | — (búsqueda por texto completo) | — |

**El usuario elige el motor explícitamente para cada documento** (`AnalysisMode = "gemini" | "groq" | "local" | "auto"`), en el subidor, en la ficha del documento y en el selector del comparador (`components/engine-selector.tsx`, alimentado por `GET /api/ai/providers`, que solo lista los proveedores con API key configurada). No hay degradación silenciosa por defecto:

- Elegir **`gemini`** o **`groq`** es una elección estricta — si ese proveedor falla, el error se muestra tal cual, sin cambiar de motor por su cuenta.
- **`auto`** es una elección más, no la implícita: prueba los proveedores configurados en el orden `PROVIDER_ORDER` y, si todos se quedan sin cuota (regex `isQuotaError` sobre 429/quota/rate-limit/…), continúa en el motor local.
- **`local`** nunca llama a un proveedor externo.
- Los embeddings son la única excepción pragmática: al ser una mejora (búsqueda semántica) y no un requisito para poder analizar el documento, se omiten silenciosamente ante falta de cuota **en cualquier modo**, incluido `gemini` explícito — la búsqueda sigue funcionando por texto completo en español.

Cada etapa persiste qué motor la resolvió (`classification._motor`, `document_summaries.model`) y lo devuelve en la respuesta (`engine`, `engineLabel`), visible en la interfaz. Añadir un tercer proveedor es sumar una entrada a `META`/`PROVIDER_ORDER` en `ai-providers.ts` y sus variables de entorno — `structuredCompletion`, `analysis.service.ts` e `ingestion.service.ts` ya son genéricos sobre `ProviderId`.

## 3. RAG híbrido con permisos

1. **Recuperación** — RPC `hybrid_search`: búsqueda vectorial (`vector_cosine_ops`, índice HNSW) + léxica (tsvector `spanish`, websearch syntax) fusionadas por **Reciprocal Rank Fusion** (k=60). Filtros pre-recuperación: documento(s), tipo, cliente.
2. **Autorización** — las funciones RPC son `security definer` pero validan `can_read_document()` por chunk: un usuario jamás recupera contenido de documentos no autorizados, incluso vía búsqueda semántica.
3. **Generación** — el contexto se etiqueta `[chunk_id | doc | pág. X | sección]`; el agente responde en streaming y emite al final un bloque JSON de citas + confianza (delimitador `<!--citas-->`) que el handler separa antes de persistir. Las citas siempre referencian chunks reales recuperados.
4. **Agentes** — 5 system prompts especializados (`core/ai/agents.ts`) que comparten la regla: *nunca inventar; sin contexto, decirlo*.

**Extracción estructurada**: toda salida analítica de IA (clasificación, resumen, variables, requerimientos, timeline, cumplimiento, diferencias, análisis de reclamo) usa **Structured Outputs validado con Zod** (`core/ai/schemas.ts` + `structuredCompletion`), con retry ante fallo de parseo. `structuredCompletion` acepta `provider`+`speed` (vía multi-proveedor, usada por el pipeline de ingesta) o un `model` ya resuelto (compatibilidad, usada por chat/reclamos/comparador — siempre Gemini hoy). El JSON estructurado se persiste en columnas tipadas + `jsonb` para búsquedas y reportes.

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
