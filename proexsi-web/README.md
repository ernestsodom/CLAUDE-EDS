# Proexsi · Sitio web con back office

Sitio público de la ticketera de Proexsi para corporaciones culturales, con back office para editar
contenidos y un panel de gestión con métricas de visitas. Se publica en **Vercel** y guarda todo en **Neon (Postgres)**.

## Qué incluye

- **Sitio público** (`/`): se arma en el servidor a partir de la plantilla (`src/template.html`) y del contenido guardado en la base.
- **Back office** (`/admin`): textos, fotos y logo, carrusel, páginas de productos, página Nosotros, colores,
  tipografías, SEO, versiones (restaurar), solicitudes de demo y panel de gestión.
- **Métricas propias**: visitas, visitantes únicos, sesiones, fuentes de tráfico, secciones más vistas,
  páginas, dispositivos, países/ciudades, horario y clics en botones. No usa cookies de terceros.

## Estructura

| Ruta | Qué hace |
|---|---|
| `src/template.html` | Diseño aprobado de la maqueta (fuente de la plantilla). |
| `scripts/prepare-template.mjs` | Marca los textos editables y genera `lib/template.js` y `lib/defaults.js`. |
| `api/render.js` | Sirve el sitio público con el contenido de la base. |
| `api/admin.js` | API del back office (requiere sesión). |
| `api/track.js` | Registra visitas, secciones y clics. |
| `api/lead.js` | Guarda las solicitudes del formulario de demo. |
| `api/img.js` | Entrega las fotos subidas desde el back office. |
| `public/admin/` | Interfaz del back office. |
| `public/img/` | Fotos originales del sitio. |

## Variables de entorno (Vercel)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a Neon. |
| `ADMIN_PASSWORD` | Contraseña del back office. |
| `SESSION_SECRET` | Firma de la sesión del back office (texto aleatorio largo). |

## Desarrollo local

```bash
npm install
npm run prepare-template   # solo si cambias src/template.html
npm run dev                # http://localhost:3000 y http://localhost:3000/admin (contraseña: admin)
```

Sin `DATABASE_URL`, el servidor local guarda todo en memoria.
