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

## Versión 3 (`v3.html`)

Inspirada en sitios premiados de estudios de desarrollo (Lusion, Active Theory, Immersive Garden, basement.studio y Dropbox Brand). Usa las mismas imágenes de `img/` y un solo tema oscuro, por decisión de diseño.

1. **Portada animada**: mapa de Chile dibujado en canvas, con los 20 municipios clientes en su ubicación aproximada, conectados al data center en Santiago. Los datos viajan por las conexiones en tiempo real.
2. **Manifiesto** con tipografía gigante: los procesos que pasan por los sistemas de Proexsi se encienden al hacer scroll.
3. **Capítulos horizontales**: las 4 fotos del slider original avanzan de lado al bajar (en celular se apilan en vertical).
4. **Índice de soluciones**: filas grandes que muestran una foto siguiendo al cursor y se abren con el detalle.
5. **Bloques de color** para las 12 áreas, cada uno con su número de módulos; al hacer clic se abre una ficha con la lista.
6. **Escala**, **calidad** (+45 años e ISO) y **muro de 20 logos** con su región.
7. **Cierre "Hablemos."** en tipografía gigante, con los datos de contacto y el formulario.
8. **Menú** a pantalla completa.

## Versión 4 (`v4.html`): inspirada en Aprova, IPM y Gove

Sitio claro, tipo producto, orientado a pedir una demostración:

1. **Barra de aviso** (ISO, Mercado Público, data center) y menú con botón "Agendar demostración".
2. **Hero** con titular que escribe procesos concretos ("Modernice los permisos de circulación / las patentes…"), foto y tarjetas flotantes de módulos (IPM + Gove).
3. **Logos de clientes** justo bajo el hero (Gove) y **cifras** verificables.
4. **Recorrido por la plataforma** (Aprova): pestañas con una interfaz ilustrativa de 5 módulos. Los datos son de ejemplo; los nombres de módulos son reales.
5. **Soluciones** en bloques alternados con beneficios y cifras (IPM).
6. **Caso de éxito** como plantilla con campos punteados para completar con datos reales (Gove).
7. **Servicios para el vecino** en un teléfono con los pasos de un pago en línea (Gove).
8. **Data center**, **preguntas frecuentes** (Aprova) y **contacto**.

## Versión 5 (`v5.html`): inspirada en Softplan, 1Doc y MuniDigital

1. **Hero oscuro** con collage de personas y botón "Acceso clientes" en el menú (Softplan + MuniDigital). El enlace al portal de clientes queda por definir.
2. **Tres tarjetas altas** de soluciones (Softplan) y franja de cifras.
3. **"Diga adiós al papel"** con 6 grupos de módulos (1Doc).
4. **Presentes de norte a sur**: esquema de las 16 regiones con las 6 que tienen clientes (1Doc).
5. **Banda fotográfica** "Del mesón al celular del vecino" con servicios en línea (MuniDigital).
6. **Historias**: placeholder para una serie de videos con municipios (Softplan).
7. **Acordeón** de diferenciales y **cierre** en banda azul con captura de correo (1Doc).

## Versión 6 (`v6.html`): fusión de v3 y v5

Una sola línea gráfica en toda la página: colores principales en tonos azules (azul noche para fondos oscuros, azul Proexsi y azul brillante para acentos) y detalles secundarios en naranjo (líneas de título, botón "Hablemos", mapa, viñetas). Botones en cápsula y tarjetas de esquinas iguales. Tipografías Sora e Inter Tight.

1. **Header** con "Hablemos" y "Menú" (menú a pantalla completa). Es transparente sobre el hero y al bajar pasa a un azul noche translúcido, un cambio sutil.
2. **Hero con el mapa de Chile** de v3: regiones con su número de clientes, conectadas al data center en Santiago.
3. **Cifras**, **índice de soluciones** con miniatura que sigue al cursor y **capítulos con scroll horizontal**, con textos de tamaño moderado.
4. **Proexsi AGM**: tarjetas con las fotos y textos de portal.proexsi.cl/productos. Cada una muestra el área y su número de sistemas sobre la foto, el objetivo, y un botón "Ver sistemas" que despliega la lista. Fotos en `img/areas/`.
5. **Clientes** en una franja blanca continua e **historias** (placeholder).
6. **Por qué Proexsi** en pantalla dividida de borde a borde: foto del data center con el sello ISO a la izquierda y lista desplegable a la derecha.
7. **Cierre** en una banda azul noche de borde a borde, continua con el pie: titular, captura de correo y datos de contacto en tres columnas, sin foto.

## Versión 7 (`v7.html`): estructura de ipm.com.br

Misma estructura y orden de secciones que el home de IPM Sistemas, con la línea gráfica de Proexsi (azules + detalles naranjos) y el hero de la v6:

1. **Header blanco** con logo, menú central con desplegables (Soluciones, Contenidos) y enlace "Contacto".
2. **Hero**: el de la v6 con el mapa de Chile, dentro de un bloque azul con la esquina inferior derecha redondeada, y enlace "Solicite una demostración".
3. **Fila de cifras**: frase de posicionamiento y tres datos (+45 años, 20 municipios, 81 sistemas).
4. **Soluciones en pestañas verticales**: AGM, AGCM, Sistemas de Gestión, Data Center y Servicios por Internet. Cada una con foto e interfaz ilustrativa, descripción, lista en tres columnas, tres indicadores con ícono y "Quiero conocer".
5. **Banda de confianza** azul sobre foto, con tres tarjetas ilustradas (trayectoria, relaciones de largo plazo, calidad ISO).
6. **Clientes**: carrusel de 20 logos con nombre y región, flechas y barra de avance.
7. **Tecnología**: titular centrado, imagen compuesta con marco azul y tarjetas flotantes, y seis tarjetas de diferenciales.
8. **Banner** "Conozca más" con botón.
9. **Proexsi en los medios**: carrusel de notas (plantilla).
10. **Formulario** en banda azul con tarjeta blanca (nombre, correo, teléfono, comuna, región, cargo, tipo de institución, motivo, mensaje).
11. **Pie gris** con columnas de enlaces, redes, dirección y frase de marca.

**Iconografía**: set propio de íconos de línea redondeada (24 px, trazo 1,75) con un detalle naranjo en cada uno, usado en toda la página (pestañas, indicadores, tarjetas, contacto y redes). Las tarjetas de diferenciales usan un mosaico celeste que al pasar el mouse pasa a azul, gira levemente, levanta la tarjeta, dibuja una línea naranja inferior y anima el ícono (luces del servidor, bloques que se separan, barras que crecen, check que se dibuja). Al hacer scroll entran de forma escalonada.

Se eliminaron las secciones de testimonios y de casos de éxito. Las notas de prensa están marcadas entre corchetes para reemplazar con contenido real de Proexsi.
