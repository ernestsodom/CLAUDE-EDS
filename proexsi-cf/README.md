# Proexsi · sitio + back office (Cloudflare Workers + Neon)

Sitio público y back office en un solo Worker de Cloudflare. El contenido, las imágenes subidas y las solicitudes de demo se guardan en Neon (Postgres).

## Qué se puede editar desde `/admin`

- **Paleta y tipografía**: 7 paletas predefinidas, los 15 colores uno por uno, 64 tipografías de Google Fonts para títulos y textos, grosor, tamaños y redondeo.
- **Sitio, logo y menú**: logo (teñido con la paleta u original), textos para Google, datos de contacto, botones del menú y pie de página.
- **Página de inicio**: secciones que se pueden editar, reordenar, ocultar, duplicar, eliminar y agregar (16 tipos).
- **Productos**: agregar, ordenar, ocultar y eliminar categorías. Cada una genera su tarjeta en el inicio, su enlace en el pie y su página `/productos/<dirección>`.
- **Páginas internas**: crear páginas nuevas (`/<dirección>`) armadas con los mismos tipos de sección.
- **Imágenes**: subir (se optimizan a WebP en el navegador), ver cuáles se usan y eliminarlas. Encuadre por clic sobre la foto.
- **Solicitudes de demo**: lo que llega desde el formulario, con descarga en CSV.
- **Historial**: las últimas 40 versiones publicadas, para restaurar.
- **Vista previa** en computador y celular antes de publicar.

## Publicar en Cloudflare

### Opción A: desde el panel de Cloudflare (conectado a GitHub)

1. Cloudflare → **Workers & Pages** → **Create** → **Import a repository**.
2. Elige el repositorio `ernestsodom/claude-eds` y la rama que corresponda.
3. **Root directory**: `proexsi-cf`. **Deploy command**: `npx wrangler deploy`.
4. En el Worker `proexsi-cultura` → **Settings** → **Variables and Secrets**, agrega como *Secret*:
   - `DATABASE_URL`: cadena de conexión de Neon (proyecto **proexsi-cultura-cloudflare** → **Connect**; usa la conexión *pooled*).
   - `ADMIN_PASSWORD`: clave del back office.
   - `SESSION_SECRET`: texto aleatorio largo (por ejemplo, 40 caracteres).
5. Vuelve a desplegar. El sitio queda en `https://cultura360.cl` y el back office en `/admin`.
6. Para un dominio propio: Worker → **Settings** → **Domains & Routes** → **Add custom domain**.

### Opción B: desde la terminal

```bash
cd proexsi-cf
npm install
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

## Desarrollo local

```bash
npm install
npm run dev   # http://127.0.0.1:8787 · back office: /admin (clave: admin)
```

Sin `DATABASE_URL` el sitio funciona en memoria (los cambios se pierden al reiniciar). Para usar Neon en local, crea `.dev.vars` con `DATABASE_URL=...`.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `src/worker.js` | Rutas: páginas públicas, `/media/:id`, `/api/lead` y la API del back office |
| `src/render.js` | Arma el HTML de cada página a partir del contenido |
| `src/schema.js` | Tipos de sección, campos editables y paletas (el back office se arma con esto) |
| `src/defaults.js` | Contenido inicial (el de la maqueta aprobada) |
| `src/fonts.js` · `src/icons.js` | Tipografías e íconos disponibles |
| `src/db.js` | Acceso a Neon (las tablas se crean solas) |
| `public/site.css` · `public/site.js` | Estilos y script del sitio |
| `public/admin/` | Back office |
| `public/img/` | Imágenes incluidas (si agregas archivos aquí, corre `npm run images`) |

Para agregar un tipo de sección nuevo: defínelo en `BLOCKS` (`src/schema.js`), agrega su función en `R` (`src/render.js`) y su plantilla inicial en `BLOCK_TEMPLATES` (`public/admin/admin.js`).
