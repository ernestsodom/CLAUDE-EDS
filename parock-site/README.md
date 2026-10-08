# Sitio web PAROCK (parock.cl)

Sitio corporativo con back office, desplegado en Vercel con base de datos Neon (Postgres).

## Estructura
- `static/render.js`: arma todas las páginas públicas (servidor y vista previa del admin).
- `static/defaults.js`: contenido inicial (se usa si la base de datos está vacía).
- `static/admin.js` + `admin/index.html`: back office en `/admin`.
- `api/`: funciones de Vercel (`page`, `content`, `login`, `upload`, `img`, `contact`).
- `lib/`: conexión a Neon y sesión del administrador.

## Páginas
`/`, `/nosotros`, `/propuesta`, `/portafolio`, `/portafolio/<producto>`, `/contacto`, `/privacidad`.

## Variables de entorno (Vercel)
- `DATABASE_URL`: cadena de conexión de Neon.
- `ADMIN_PASSWORD`: clave del back office.
- `SESSION_SECRET`: texto aleatorio para firmar la sesión.

## Base de datos (Neon)
Tablas: `site_content` (contenido actual), `site_history` (últimas 30 versiones), `images` (fotos subidas), `contact_messages` (formulario).

## Prueba local
`ADMIN_PASSWORD=yiti DEV_MOCK_DB=1 node dev-server.js` (usa una base en memoria).
