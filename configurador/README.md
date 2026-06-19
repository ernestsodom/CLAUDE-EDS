# PadelStudio — Configurador 3D de Canchas de Pádel

Aplicación web para **personalizar canchas de pádel en 3D en tiempo real**,
pensada como herramienta de venta: el cliente arma su cancha, ve el precio
referencial al instante y envía la cotización.

## Funcionalidades

| Categoría | Opciones |
|---|---|
| Tipo de pista | **Panorámica 100%** (vidrio 3 m pegado con silicona, sin perfiles) / **Semi panorámica** (perfiles solo en las 4 esquinas) / **Normal** (pilares verticales completos). Todas con vidrio de 3 m + franja de malla de 1 m arriba (4 m total, reglamento FIP) |
| Entorno | **Estudio** / **Estadio** (gradas con público, vallas LED, techo de arena) / **Indoor** (nave de 15 m) / **Patio de casa** / **Club** / **Campo** / **Azotea de edificio** |
| Momento | **Día / Noche** (LED encendidas, ventanas de la ciudad iluminadas, acentos flúor brillando) |
| Césped | 9 colores + selector libre |
| Líneas de juego | 6 colores + selector libre |
| Estructura (perfiles, postes, rejas) | 6 colores + selector libre |
| Postes de luz | Color **independiente** de la estructura — 6 colores + libre |
| Acentos | Riel perimetral, marcos de acceso y detalles — 7 colores + libre |
| Iluminación | Postes que **nacen de la estructura como una sola pieza** (no apéndices): **Brazo curvo** / **Mástil recto WPT** (cruceta + doble proyector) / **Mástiles de esquina 45°** estilo Premier Padel / **Riel LED perimetral** |
| Detalles | Placas de anclaje con pernos hexagonales, abrazaderas con pernos, manguitos de unión riel-poste, juntas de silicona en vidrio panorámico, fijaciones botón en semi |
| Branding | **Subir logo** (pista, vidrio de fondo o ambos, con tamaño regulable) + **nombre del club** |
| Ventas | **Precio referencial** desglosado en CLP en vivo + botón **Solicitar cotización** |
| Extras | **12 presets**, captura PNG, compartir por enlace, rotación automática |

## Cómo ejecutarlo

Es 100% estático (sin backend). Three.js va incluido en `js/vendor/`,
no requiere internet ni instalación de dependencias:

```bash
cd configurador
python3 -m http.server 8080
# abrir http://localhost:8080
```

o con Node: `npx serve configurador`. Para producción basta subir la
carpeta a cualquier hosting estático (Netlify, Vercel, GitHub Pages, S3…).

> Nota: debe servirse por HTTP (no abrir el archivo con doble clic),
> porque usa módulos ES.

## Arquitectura

- `js/court3d.js` — construcción **paramétrica** de la cancha (dimensiones
  reglamentarias FIP 20×10 m, las mismas del render de `../padel_render`).
  Sin dependencias de DOM: testeable headless.
- `js/app.js` — interfaz, materiales/texturas procedurales (malla, red,
  césped, cielo), iluminación día/noche, precios, logo, compartir.
- `test/smoke.mjs` — prueba de humo: construye las 12 combinaciones
  (tipo × luces × entorno) y verifica la escena. Ejecutar:
  `node test/smoke.mjs`.

## Personalizar precios

Los valores referenciales (CLP) están en `computePrice()` dentro de
`js/app.js` — base por tipo de cancha, iluminación, kit indoor, césped
premium, logos y rotulación. Ajústalos a tu lista real.
