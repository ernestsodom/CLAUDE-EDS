# PADEL BUSINESS MANAGEMENT PLATFORM

Sistema operativo de gestión del negocio de canchas de pádel: fabricación,
comercialización, exportación, logística, instalación y gestión financiera,
para Europa y Argentina.

**Estado: FASES 1-9 y 11-13 completadas y verificadas.**
Base de datos + seguridad, aplicación Next.js conectada a datos reales y
formularios de alta y edición para las 19 entidades del negocio.

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
| Migraciones SQL | 25, ejecutables y probadas |
| Páginas de la aplicación | 56 |
| Server Actions | 39 |
| Pruebas | 40 aserciones de negocio + suite RLS + 52 consultas y 29 escrituras del frontend |

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
cp .env.example .env.local     # y completa las claves del proyecto
npm install
supabase start
supabase db reset              # aplica las 24 migraciones + seed.sql
npm run dev                    # http://localhost:3000
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
├── app/
│   ├── (auth)/login              Login real contra Supabase Auth
│   └── (dashboard)/[project]/    El proyecto vive en la URL, no en estado global
│       ├── dashboard · hoy · control-center
│       ├── comercial/            clientes (+360) · oportunidades · reuniones · seguimientos
│       ├── ventas/               listado + ficha completa (§73)
│       ├── operaciones/          fabricación · canchas (+ficha §74) · materiales · proveedores
│       │                         compras · logística · instalaciones · calidad · inventario
│       ├── finanzas/             contratos · facturas · pagos · gastos · bancos · rentabilidad
│       └── documentos · tareas · reportes · configuración
├── components/  ui · dashboard · commercial · operations · finance · shared
├── lib/         supabase · auth · permissions · services · validations · format
├── actions/     Server Actions: única vía de escritura
├── types/       Tipos del dominio (regenerables con supabase gen types)
├── docs/ARCHITECTURE.md      Arquitectura técnica completa (ERD, RLS, KPIs, IA, plan)
├── supabase/
│   ├── migrations/           24 migraciones SQL versionadas
│   ├── seed.sql              Datos demo realistas (idempotente)
│   └── tests/
│       ├── 00_supabase_shim.sql     Emula Supabase sobre PostgreSQL vanilla
│       ├── 01_business_cases.sql    Casos §101, §102, §103 y cálculos financieros
│       ├── 02_rls_security.sql      Aislamiento multi-proyecto y escalada de privilegios
│       ├── 03_frontend_queries.mjs  Las 52 consultas reales de las páginas, vía PostgREST
│       ├── 04_frontend_writes.mjs   Las altas y ediciones, con triggers y RLS
│       └── run.sh                   Runner completo
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

## Cómo está construido el frontend

- **Lectura por Server Components** contra las vistas analíticas; **escritura por
  Server Actions**. El navegador nunca habla directamente con la base para escribir.
- **Paginación en el servidor** (`.range()` + `count: exact`): una tabla de 50.000
  ventas envía 25 filas al navegador, no 50.000.
- **El estado de filtros vive en la URL**, no en React: las vistas son
  compartibles por enlace y el botón «atrás» funciona.
- **`confirm_sale()` y `change_court_status()` no se reimplementan en TypeScript**:
  la acción invoca la función de PostgreSQL, que hace todo en una transacción.
- **Los permisos del cliente deciden qué se muestra; RLS decide qué es posible.**
  Ocultar un botón es usabilidad, no seguridad.
- **`service_role` nunca llega al navegador**: `lib/supabase/server.ts` importa
  `server-only`, así que el build falla si alguien lo importa desde un cliente.

## Alta y edición

Hay formulario de alta y edición para las 19 entidades del negocio: clientes,
oportunidades, reuniones, seguimientos, ventas (con líneas y costos), facturas
(con líneas), pagos, contratos, gastos, cuentas bancarias, proveedores, órdenes
de compra (con líneas), canchas, fabricación, materiales, logística,
instalaciones y controles de calidad.

Tres reglas comunes a todos:

- **Los totales nunca se envían desde el formulario.** El total de una venta, de
  una factura o de una orden sale de sus líneas mediante trigger; el saldo de una
  factura, de sus pagos. Así cabecera y detalle no pueden discrepar.
- **Las validaciones son espejo de los constraints SQL.** Zod da el mensaje útil;
  PostgreSQL es quien garantiza que el dato no entra mal por ninguna otra vía.
- **El borrado es lógico** (`deleted_at`) en toda entidad con valor histórico.

## Siguiente fase

FASE 10 y 14 — Subida de documentos a Storage con URLs firmadas, importación de
extractos bancarios CSV/XLSX, exportación PDF y el asistente de IA acotado por RLS.

El plan completo de las 15 fases está en `docs/ARCHITECTURE.md` §18.
