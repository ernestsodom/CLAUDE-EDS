# Maqueta Home Proexsi

Maqueta visual navegable para el nuevo home de Proexsi. Abra `index.html` en el navegador; las imágenes están en `img/`.

## Fuente del contenido

Contenido extraído del home de `portal.proexsi.cl` (el sitio al que lleva `proexsi.cl`) y de su página de Productos, que se usó para el explorador de módulos.

## Imágenes

Todas las imágenes del home actual, descargadas y optimizadas para web en `img/`:

- `slide-*.jpg`: las 4 fotos del slider principal (1600 px de ancho).
- `area-*.jpg`: fotos de Soluciones GRP, Sistemas de Gestión y Data Center, con su versión hover (`*-hover.jpg`).
- `pilar-*.jpg`: fotos de los 4 pilares (trayectoria, relaciones, ISO, tecnología).
- `icon-*.png`: íconos de las áreas y de las cifras.
- `logo-proexsi.png` y `sello-iso-mercadopublico.png`.
- `clientes/*.png`: 20 logos de municipios, recortados y normalizados.

Los colores (azul `#0035A9`, naranjo `#F29400`) se tomaron del CSS del sitio actual.

## Estructura

1. Header fijo con menús desplegables (Soluciones, Data Center) y menú móvil.
2. Slider fotográfico con los 4 mensajes del sitio actual (autoplay, flechas, swipe).
   Debajo, franja de cifras con los íconos originales.
3. Pilares con foto: trayectoria, relaciones de largo plazo, ISO 9001:2015 y continuidad operacional.
4. Soluciones con foto e ícono (cambia de foto al pasar el mouse): GRP (AGM / AGCM), Sistemas de Gestión y Data Center.
5. Explorador de módulos por área (pestañas en escritorio y selector en móvil).
6. Data Center: Hosting, Housing y certificación ISO.
7. Clientes: 20 logos en dos carriles animados.
8. Contacto: datos copiables y un formulario demostrativo.
9. Footer.

Incluye modo claro y oscuro (según el sistema) y un botón "Notas de maqueta" con estas decisiones.

## Información omitida o modificada

- **Carrusel de 4 slides**: se fusionó en un solo hero y 4 pilares, y se quitaron los botones "Ver productos" repetidos.
- **Cifras** (permisos de circulación gestionados y recaudados, liquidaciones por mes, causas judiciales, personas conectadas): el sitio actual las muestra en 0, así que la maqueta indica solo la magnitud ("Millones", "Miles"). Reemplazar por los valores reales.
- **Logos de clientes**: se renombraron sin los sufijos de año ("Iquique 2022", "Las Condes 2024").
- **Crédito del webmaster**: retirado del pie de página.
- **Formulario**: solo demostrativo, no envía datos.
- **Imagen no incluida**: `servicios-proexsi-slider.jpg` está referenciada en el CSS desde un servidor de pruebas antiguo del webmaster y no se muestra en el home.

## Versión 2 (`v2.html`)

Una diagramación distinta con las mismas imágenes de `img/`, pensada más como producto que como folleto:

1. **Menú flotante en cápsula** con botón "Buscar módulo" (atajo: tecla `/`).
2. **Hero con buscador**: "¿Qué proceso quiere digitalizar?", con sugerencias populares y un collage de 3 fotos con tarjetas flotantes (municipios, data center).
3. **Grilla bento** (4×3): Soluciones GRP, Sistemas de Gestión, Data Center, calidad ISO, escala de operación con los 5 íconos, +45 años y relaciones de largo plazo.
4. **Buscador de módulos**: búsqueda en vivo (sin importar tildes) sobre los 81 módulos, filtros por área y resaltado del texto encontrado.
5. **Data Center** con selector Hosting / Housing que cambia el texto y la foto.
6. **Clientes de norte a sur**: los 20 logos agrupados por región (Tarapacá a Los Lagos) sobre un eje de latitud.
7. **Contacto** en una tarjeta: foto con los datos de contacto y un formulario con selección de interés.

La versión 1 (`index.html`) queda intacta para comparar.
