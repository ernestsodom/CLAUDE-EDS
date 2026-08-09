# PADEL BUSINESS MANAGEMENT PLATFORM

Sistema operativo de gestión del negocio de canchas de pádel: fabricación,
comercialización, exportación, logística, instalación y gestión financiera,
para Europa y Argentina.

**Estado: FASE 1 (arquitectura + base de datos + seguridad) completada y verificada.**

| | |
|---|---|
| Tablas | 59 |
| Vistas analíticas | 15 |
| Índices | 236 |
| Políticas RLS | 220 |
| Triggers | 110 |
| Enums | 39 |
| Permisos granulares | 136 |
| Constraints | 344 |
| Migraciones SQL | 24, ejecutables y probadas |
| Pruebas | 40 aserciones de negocio + suite de aislamiento RLS |

La arquitectura completa está en **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## Las tres unidades de negocio

| Proyecto | Código | Alcance |
|---|---|---|
| Europa | `EUROPA` | Fabricación y venta de canchas nuevas |
| Atila | `ATILA` | Unidad de negocio Atila |
| Canchas usadas | `VENTA_USADAS` | Compra, refurbishment y reventa |

Todo dato operacional lleva `project_id` y los proyectos están **aislados por RLS
en PostgreSQL**, no por filtros en el frontend.

---

## Puesta en marcha

### Con Supabase

```bash
supabase start
supabase db reset      # aplica las 24 migraciones + seed.sql
```

### Verificación sobre PostgreSQL vanilla (CI, sin Supabase)

```bash
./supabase/tests/run.sh
```

Levanta un cluster efímero, aplica todo y ejecuta las dos suites de pruebas.

### Usuarios demo

Contraseña para todos: `Padel2026!`

| Email | Acceso |
|---|---|
| `ernesto@padelbusiness.com` | Super admin — ADMIN en los 3 proyectos |
| `comercial@padelbusiness.com` | COMERCIAL en EUROPA y VENTA_USADAS |
| `operaciones@padelbusiness.com` | OPERACIONES en EUROPA, LECTURA en ATILA |
| `finanzas@padelbusiness.com` | FINANZAS en EUROPA |

Entrar con cada uno muestra el aislamiento por proyecto y por permisos funcionando.

---

## Estructura

```
padel-platform/
├── docs/ARCHITECTURE.md      Arquitectura técnica completa (ERD, RLS, KPIs, IA, plan)
├── supabase/
│   ├── migrations/           24 migraciones SQL versionadas
│   ├── seed.sql              Datos demo realistas (idempotente)
│   └── tests/
│       ├── 00_supabase_shim.sql   Emula Supabase sobre PostgreSQL vanilla
│       ├── 01_business_cases.sql  Casos §101, §102, §103 y cálculos financieros
│       ├── 02_rls_security.sql    Aislamiento multi-proyecto y escalada de privilegios
│       └── run.sh                 Runner completo
└── .env.example
```

---

## Decisiones que conviene conocer antes de tocar el código

- **La lógica crítica está en PostgreSQL.** `confirm_sale()` crea canchas,
  fabricación, costos y checklists en una sola transacción. El frontend la
  invoca; no la reimplementa.
- **Los márgenes no se almacenan, se derivan** (`v_sale_financials`). Los
  snapshots históricos son explícitos (`sale_margin_snapshots`).
- **RLS es la frontera de seguridad.** Los permisos del cliente deciden qué se
  muestra; la base decide qué es posible.
- **La moneda nunca se convierte sola.** Sin una tasa registrada con fecha y
  fuente, `convert_amount()` devuelve NULL.
- **La IA no escribe en el negocio sin aprobación humana.** Lo impone un
  constraint, no una convención.
- **`service_role` jamás en el cliente.**

---

## Siguiente fase

FASE 2 — Autenticación y shell de la aplicación: login Supabase,
`get_session_context()`, selector de proyecto, sidebar dinámico según módulos
habilitados y permisos efectivos, tema oscuro (negro + naranja flúor).

El plan completo de las 15 fases está en `docs/ARCHITECTURE.md` §18.
