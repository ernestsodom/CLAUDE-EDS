# PadelStudio — Configurador 3D de Canchas de Pádel

Aplicación web para **personalizar canchas de pádel en 3D en tiempo real**,
pensada como herramienta de venta: el cliente arma su cancha, ve el precio
referencial al instante y envía la cotización.

## Funcionalidades

| Categoría | Opciones |
|---|---|
| Tipo de cancha | **Panorámica** (vidrio continuo sin postes) / **Clásica** (postes intermedios) |
| Entorno | **Outdoor** / **Indoor** (nave deportiva con cerchas y luminarias) |
| Momento | **Día / Noche** (LED encendidas, acentos flúor brillando) |
| Césped | 6 colores + selector libre |
| Estructura y postes | 5 colores + selector libre |
| Acentos | Riel perimetral, marcos de acceso y detalles — 6 colores flúor + libre |
| Iluminación | **Brazo curvo** (sobre estructura) / **Columna recta** / **Riel LED perimetral** |
| Branding | **Subir logo** (pista, vidrio de fondo o ambos, con tamaño regulable) + **nombre del club** rotulado en los fondos |
| Ventas | **Precio referencial** desglosado en CLP que se actualiza en vivo + botón **Solicitar cotización** (correo pre-armado) |
| Extras | **Captura PNG** de la vista, **compartir configuración por enlace**, rotación automática, presets de diseño |

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
