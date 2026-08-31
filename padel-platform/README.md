# PADEL BUSINESS MANAGEMENT PLATFORM

Sistema operativo de gestión del negocio de canchas de pádel: fabricación,
comercialización, exportación, logística, instalación y gestión financiera,
para Europa y Argentina.

**Estado: las 15 fases completadas y verificadas.**
Base de datos + seguridad, aplicación Next.js conectada a datos reales,
formularios de alta y edición para las 19 entidades del negocio, gestión
documental sobre Supabase Storage, conciliación bancaria, IA con revisión
humana obligatoria, y el hardening operativo para producción: exportación
real de reportes, motor de alertas con disparo automático, healthcheck,
backups, cabeceras de seguridad, CI y pruebas E2E de navegador.

| | |
|---|---|
| Tablas | 67 |
| Vistas analíticas | 19 |
| Índices | 263 |
| Políticas RLS | 244 (218 tablas + 26 Storage) |
| Triggers | 125 |
| Enums | 41 |
| Permisos granulares | 144 |
| Constraints | 391 |
| Migraciones SQL | 29, ejecutables y probadas |
| Páginas de la aplicación | 65 |
| Server Actions | 85 |
| Rutas API | 3 (`/api/health`, `/api/cron/alerts`, `/api/export`) |
| Pruebas | 40 aserciones de negocio + 38 del módulo Negocios + suite RLS + 61 consultas, 47 escrituras y 42 comprobaciones de documentos, banca e IA — automatizadas en CI |

La arquitectura completa está en **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## Las tres unidades de negocio

| Proyecto | Código | Alcance |
|---|---|---|
| Europa | `EUROPA` | Fabricación y venta de canchas nuevas |
| Atila | `ATILA` | Trading: intermediación entre la fábrica y Atila (módulo Negocios) |
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
supabase db reset              # aplica las 29 migraciones + seed.sql
npm run dev                    # http://localhost:3000
```

### Verificación sobre PostgreSQL vanilla (CI, sin Supabase)

```bash
./supabase/tests/run.sh
```

Levanta un cluster efímero, aplica todo y ejecuta las seis suites de pruebas.

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
│       ├── negocios/             tablero del trader · ficha con canchas, acabados y logos
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
│   ├── migrations/           29 migraciones SQL versionadas
│   ├── seed.sql              Datos demo realistas (idempotente)
│   └── tests/
│       ├── 00_supabase_shim.sql     Emula Supabase sobre PostgreSQL vanilla
│       ├── 01_business_cases.sql    Casos §101, §102, §103 y cálculos financieros
│       ├── 02_rls_security.sql      Aislamiento multi-proyecto y escalada de privilegios
│       ├── 03_frontend_queries.mjs  Las 61 consultas reales de las páginas, vía PostgREST
│       ├── 04_frontend_writes.mjs   Las altas y ediciones, con triggers y RLS
│       ├── 05_reconciliation_ai.mjs Conciliación, versionado documental y revisión de IA
│       ├── 06_atila_deals.sql       Reglas del módulo Negocios (trader / Atila)
│       └── run.sh                   Runner completo
├── app/api/     health · cron/alerts · export (rutas de servidor, FASE 15)
├── scripts/backup.sh         pg_dump del esquema de negocio (npm run db:backup)
├── e2e/                      Pruebas de navegador con Playwright (necesitan BASE_URL)
├── .github/workflows/        CI en cada push/PR + cron de alertas por hora
├── vercel.json                Cron de alertas para despliegue en Vercel
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

## Hardening operativo (FASE 15)

- **Exportación real.** `/api/export?project=EUROPA&entity=ventas&format=xlsx`
  sirve CSV y XLSX de los nueve reportes con la misma RLS y el mismo permiso
  `<módulo>.export` que la pantalla. Sin dependencias: el XLSX es el ZIP + XML
  mínimo que Excel necesita.
- **El motor de alertas se ejecuta solo.** `app.generate_alerts()` no tenía
  ninguna vía de disparo en producción. `/api/cron/alerts`, protegido por
  secreto compartido, lo dispara vía Vercel Cron (`vercel.json`) o el workflow
  `.github/workflows/alerts-cron.yml` (cada hora, sin depender de Vercel).
- **`/api/health`** distingue "la app responde" de "la base responde".
- **`error.tsx` / `loading.tsx` / `not-found.tsx` / `global-error.tsx`** evitan
  la pantalla en blanco de Next sin filtrar detalle técnico al usuario.
- **`npm run db:backup`** (`scripts/backup.sh`) vuelca `public` y `app` con
  `pg_dump -Fc`; complementa el PITR de Supabase sobre `auth` y `storage`.
- **Cabeceras de seguridad** en `next.config.mjs`: no sustituyen a RLS, cierran
  lo que RLS no puede tocar porque ocurre en el navegador.
- **CI** (`.github/workflows/ci.yml`): `tsc`, `next build` y las cinco suites
  de `run.sh` contra un PostgreSQL de servicio, en cada push y PR.
- **E2E** (`playwright.config.ts`, `e2e/smoke.spec.ts`): camino crítico con una
  sesión real de Supabase Auth. Requiere `BASE_URL` de un entorno desplegado;
  se salta explícitamente si no está configurado.

Con esto, las 15 fases del plan en `docs/ARCHITECTURE.md` §18 están entregadas.

## Módulo Negocios: la unidad de negocio ATILA (migración 028)

En ATILA la empresa **no fabrica ni vende al club final: es el trader** entre la
fábrica y Atila, que es quien negocia, pone precios y vende. Ni el detalle
comercial de Atila ni el industrial de la fábrica aportan nada a ese trabajo,
así que ATILA no usa las mismas pantallas que EUROPA.

- **Negocios** (`/ATILA/negocios`) es la única pantalla operativa: cada negocio
  potencial con su club, sus canchas, la comisión y las fechas. Los KPIs miran
  todos los negocios (no la página visible): comisión potencial, comisión
  cerrada y próxima entrega.
- **Una fila por cancha**, no una cantidad: cada cancha lleva su tipo, su
  comisión (1.700 USD por defecto, ajustable) y, si es personalizada, la
  ubicación de cada logo en una rejilla *marca × posición* (Atila / club ×
  entrada, postes de luz, postes de red, cubre resortes).
- **Acabados por cancha**: color de césped y color de los postes de luz, cada
  uno de su propia carta de color (Azul, Negro, Terracota, Gris oscuro de
  partida). Son cartas distintas a propósito: la del césped y la de los postes
  no tienen por qué coincidir.
- **Visualizador 3D de muestra**: cada cancha abre una vista 3D con sus colores
  reales, servida por [PadelStudio](https://padelstudio-theta.vercel.app) —el
  configurador que ya existía— cargando la configuración por su propio formato
  de enlace. La pantalla avisa de forma visible que es una imagen de muestra y
  no un plano de fabricación.
- **Los cuatro catálogos son editables** (`/ATILA/configuracion/catalogos`):
  tipos de cancha, ubicaciones de logo, colores de césped y colores de postes.
  Renombrar "Atila Pro" o añadir un color es un dato, no un despliegue.
- **Sin venta cerrada no hay fecha de entrega.** La regla vive en el CHECK
  `deals_dates_ck`; el formulario ni siquiera muestra el campo mientras el
  negocio siga abierto. Las dos capas se verifican en
  `supabase/tests/06_atila_deals.sql` y en la suite de escrituras del frontend.
- **Menú reducido a lo que usa un trader**: Negocios, Documentos, Tareas,
  Reportes y Configuración. Lo apagado no se borra, y cualquier administrador
  puede volver a encenderlo desde Configuración → Módulos, que ahora es
  interactivo. Entrar a la aplicación lleva a la primera pantalla habilitada de
  cada proyecto, no siempre al Dashboard.

EUROPA y VENTA_USADAS mantienen su operación completa: la diferencia entre
unidades de negocio es configuración (`project_modules`), no código duplicado.
