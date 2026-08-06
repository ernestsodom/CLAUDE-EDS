# LicitIA — Plataforma de Inteligencia Documental

Plataforma web profesional para **administrar, analizar y comparar** licitaciones públicas, bases administrativas y técnicas, propuestas, contratos, cartas Gantt, anexos, reclamos, informes y actas — convirtiendo todo en una **base de conocimiento corporativa consultable por IA** con citas verificables.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · shadcn/ui · React Query |
| Backend | API Routes + Server Actions (Next.js) |
| Datos | Supabase: PostgreSQL + pgvector · Storage · Auth · RLS |
| IA | OpenAI GPT-5.x (chat/análisis) · text-embedding-3-small (RAG) · OCR vía visión |
| Hosting | Vercel (región `gru1`, funciones de larga duración para el pipeline) |

## Capacidades principales

- **Ingesta inteligente**: drag & drop de PDF/DOCX/XLSX/TXT/PPT/ZIP → extracción de texto (con **OCR automático** para escaneados) → chunking → embeddings → **clasificación automática** (20+ metadatos) → **resumen ejecutivo** → **variables técnicas** individuales → **requerimientos** → **línea de tiempo**.
- **Chat RAG con 5 agentes especializados** (Analista, Comparador, Reclamos, Propuestas, Comercial), streaming, **citas exactas con página/sección** y **nivel de confianza**. Historial: reabrir, continuar, duplicar, buscar, etiquetar, favoritas.
- **Control de cumplimiento (comprometido vs entregado)**: el documento base (licitación/bases técnicas/contrato) contra tu **documento de control propio** de lo realmente entregado → tabla requerimiento a requerimiento (estado, evidencia, página, comentario IA, riesgo, prioridad), porcentajes y **semáforo**; más la **pasada inversa** que detecta trabajos adicionales fuera de acuerdo, incluidos los realizados **sin costo** (tabla `delivered_items`). Además diferencias entre dos licitaciones/propuestas/contratos/versiones.
- **Módulo de reclamos**: pega el correo → análisis estructurado (qué reclama, qué aplica al contrato, qué está entregado/pendiente/fuera de alcance) → **respuesta profesional redactada con evidencia citada**.
- **Búsqueda híbrida** (semántica + texto completo español, fusión RRF) con filtros por tipo y cliente.
- **Dashboard ejecutivo**, versionado de documentos, notas/pendientes/recordatorios, exportación a **PDF/Excel/Word/PowerPoint/CSV**, auditoría completa y **RLS multi-tenant** con roles (admin / supervisor / usuario) y permisos por documento.

## Inicio rápido

```bash
# 1. Base de datos — opción simple (sin instalar nada):
#    Supabase → SQL Editor → pega supabase/setup-completo.sql → Run
#    (esquema + funciones + RLS + storage + datos de ejemplo + alta
#     automática de perfiles: el primer usuario que crees será admin)
#
#    Opción con CLI (equivalente, aplica las migraciones por separado):
./scripts/setup-supabase.sh <project-ref>

# 2. Variables de entorno
cp .env.example .env.local   # completar claves de Supabase y OpenAI

# 3. Desarrollo
npm install
npm run dev                  # http://localhost:3000

# 4. Pruebas y verificación
npm run typecheck && npm test

# 5. Despliegue
./scripts/deploy-vercel.sh --prod
```

> Tras el paso 1, crea tu primer usuario en Supabase Auth y vincúlalo como `admin` (el script imprime el SQL exacto).

## Estructura del proyecto

```
licitia/
├── docs/                     # Arquitectura, UX/UI, API, manual, roadmap
├── supabase/
│   ├── migrations/           # 0001 esquema · 0002 funciones búsqueda · 0003 RLS · 0004 storage
│   └── seed.sql              # Datos de ejemplo (org, clientes, licitación demo)
├── scripts/                  # setup-supabase.sh · deploy-vercel.sh
├── src/
│   ├── app/                  # App Router: páginas + API Routes
│   │   ├── (app)/            # Shell autenticado: dashboard, documents, upload, chat, compare, claims, search
│   │   ├── login/
│   │   └── api/              # upload, internal/process, chat, search, comparisons, claims, export
│   ├── components/           # UI (shadcn-style) + componentes de dominio
│   ├── core/
│   │   ├── ai/               # Agentes, esquemas Zod (Structured Outputs), helper OpenAI
│   │   ├── domain/           # Tipos de dominio
│   │   ├── repositories/     # Repository Pattern (documents, conversations)
│   │   └── services/         # ingesta, extracción, OCR, chunking, análisis, RAG, chat,
│   │                         # comparación, reclamos, export, auditoría
│   ├── lib/                  # env, logger, errores, supabase (client/server/admin), openai
│   └── middleware.ts         # Protección de rutas + refresh de sesión
└── tests/                    # Vitest: chunking, OCR, chat, export, extracción
```

## Documentación

- [Arquitectura de software](docs/arquitectura.md) — capas, pipeline, RAG híbrido, seguridad, rendimiento
- [Diseño UX/UI y navegación](docs/ux-ui.md)
- [API y endpoints](docs/api.md)
- [Manual de usuario](docs/manual-usuario.md)
- [Plan de evolución del producto](docs/roadmap.md)
