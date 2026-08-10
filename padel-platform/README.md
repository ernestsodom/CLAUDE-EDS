# PADEL BUSINESS MANAGEMENT PLATFORM

Sistema operativo de gestión del negocio de canchas de pádel: fabricación,
comercialización, exportación, logística, instalación y gestión financiera,
para Europa y Argentina.

**Estado: FASES 1-14 completadas y verificadas.**
Base de datos + seguridad, aplicación Next.js conectada a datos reales,
formularios de alta y edición para las 19 entidades del negocio, gestión
documental sobre Supabase Storage, conciliación bancaria e IA con revisión
humana obligatoria.

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
| Migraciones SQL | 26, ejecutables y probadas |
| Páginas de la aplicación | 59 |
| Server Actions | 71 |
| Pruebas | 40 aserciones de negocio + suite RLS + 52 consultas, 29 escrituras y 42 comprobaciones de documentos, banca e IA |

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
supabase db reset              # aplica las 26 migraciones + seed.sql
npm run dev                    # http://localhost:3000
```

### Verificación sobre PostgreSQL vanilla (CI, sin Supabase)

```bash
./supabase/tests/run.sh
```

Levanta un cluster efímero, aplica todo y ejecuta las cinco suites de pruebas.

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
├── components/  ui · dashboard · commercial · operations · finance · documents · ai · shared
├── lib/         supabase · auth · permissions · services · validations · format · ai
├── actions/     Server Actions: única vía de escritura
├── types/       Tipos del dominio (regenerables con supabase gen types)
├── docs/ARCHITECTURE.md      Arquitectura técnica completa (ERD, RLS, KPIs, IA, plan)
├── supabase/
│   ├── migrations/           26 migraciones SQL versionadas
│   ├── seed.sql              Datos demo realistas (idempotente)
│   └── tests/
│       ├── 00_supabase_shim.sql     Emula Supabase sobre PostgreSQL vanilla
│       ├── 01_business_cases.sql    Casos §101, §102, §103 y cálculos financieros
│       ├── 02_rls_security.sql      Aislamiento multi-proyecto y escalada de privilegios
│       ├── 03_frontend_queries.mjs  Las 52 consultas reales de las páginas, vía PostgREST
│       ├── 04_frontend_writes.mjs   Las altas y ediciones, con triggers y RLS
│       ├── 05_reconciliation_ai.mjs Conciliación, versionado documental y revisión de IA
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

## Documentos, banca e IA

**Documentos.** El archivo va del navegador a Supabase Storage directamente,
con un permiso de subida firmado para una ruta concreta. El binario no pasa por
el servidor de Next y la `service_role` no interviene: quien autoriza es una
Storage policy bajo el JWT del usuario. Todos los buckets son privados; cada
descarga genera un enlace que caduca en dos minutos. El número de versión lo
asigna PostgreSQL, no el cliente.

**Conciliación bancaria.** El lector de CSV y XLSX no arrastra dependencias: un
XLSX es un ZIP con XML dentro. El extracto se sube, el servidor lo interpreta y
enseña lo que ha entendido —incluidas las filas que no puede leer— antes de
importar nada. Reimportar el mismo extracto no duplica movimientos: hay un
índice único por cuenta y huella. Conciliar comprueba en la base que coincidan
importe y dirección del dinero, y que un pago no se use dos veces.

**IA.** Extrae datos de facturas, BL, contratos y cotizaciones, y responde
preguntas sobre el negocio. No escribe nada por su cuenta:

- Una extracción no puede marcarse como aplicada si no está aprobada por una
  persona: lo impide un constraint.
- Las columnas de revisión no admiten `UPDATE` directo — ni siquiera del super
  admin. Solo las escribe la función que comprueba `documents.approve`.
- Al aplicar, se guardan los valores que la persona confirmó en pantalla; el
  JSON del modelo queda archivado como evidencia, no como fuente.
- El asistente no escribe SQL: elige entre ocho consultas parametrizadas que se
  ejecutan con la sesión de quien pregunta, así que RLS acota la respuesta. Si
  no encuentra el dato, lo dice.

Sin `AI_PROVIDER_API_KEY` la aplicación funciona entera; solo quedan inactivas
esas dos pantallas.

## Siguiente fase

FASE 15 — Hardening: pruebas E2E de navegador, exportación XLSX/PDF de reportes,
observabilidad, backups y despliegue en Vercel.

El plan completo de las 15 fases está en `docs/ARCHITECTURE.md` §18.
