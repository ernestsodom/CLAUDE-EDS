# Gestión de canchas — Atila Argentina / Padel Europa

Plataforma para controlar dos negocios con perfiles separados. Esta carpeta contiene,
por ahora, **solo la maqueta navegable** (`maqueta/index.html`, un único archivo HTML
sin dependencias de compilación). Los datos de proyectos vienen de la hoja CRONOGRAMA de
`ATILA_Padel_Planificacion_2026.xlsx` (9 proyectos, 29 canchas); los cambios se guardan en el
`localStorage` del navegador. El cronograma indica solo meses, así que los días de cada etapa
son estimados (producción = mes completo; salida 1–5, entrega 6, instalación 7–20 y habilitación 21
del mes de logística + instalación).

## Qué cubre la maqueta

| Módulo | Qué muestra |
| --- | --- |
| Ingreso | Equipo interno con usuario y contraseña; clientes con correo y clave. Cada usuario interno ve solo los negocios asignados (Atila Argentina, Padel Europa o ambos). Todos pueden cambiar su propia contraseña. |
| Usuarios y permisos | Solo super administrador: usuarios internos, negocios, roles, activar/desactivar, nueva contraseña y eliminar. Siempre queda al menos un super administrador activo. |
| Clientes | Mantenedor de clientes del portal (nombre, club/empresa, correo, teléfono, ciudad, negocio). Al crear el acceso el sistema propone una clave simple (por ejemplo `Volea-4821`) que se puede cambiar; luego se comparte por WhatsApp, correo o copiando el mensaje. Nueva clave, activar/desactivar y eliminar. |
| Portal de clientes | El cliente diseña su cancha en el visor 3D (tipo, césped, postes de luz, amortiguadores, logo y mapa), envía la solicitud, sigue su estado en «Mis solicitudes» y ve y acepta sus cotizaciones en «Mis cotizaciones». Solo ve lo suyo. |
| Bandeja de negocios | Etapas: nuevo contacto → propuesta enviada → negociación → venta cerrada / perdida. Las solicitudes del portal llegan marcadas como nuevas: se aceptan o modifican y se ubican en una etapa. También se cargan negocios a mano con todos los datos del cliente y el diseño de su cancha. Cotizaciones con número, ítems, moneda y validez; se envían por WhatsApp, correo o se publican en el portal del cliente. |
| Proyectos y entregas | Al cerrar la venta se crea el proyecto con el diseño del negocio. Las características de la cancha quedan de solo lectura (visor 3D + especificaciones); se hace el seguimiento de etapas, fechas y atrasos. Tarjetas coloreadas por estado. |
| Calendario y mapa | Mapa de Argentina con zoom y etiquetas por proyecto (canchas, modelo, etapa) y calendario mensual de hitos. |
| Tipos de cancha | Dos tipos: Atila Competition PRO (panorámica) y Atila Semi Panoramic, con nombre y descripción editables y su vista 3D. Lo que estaba como «Atila Estándar» pasa a Competition PRO. |

## Visor 3D

La cancha se dibuja con Three.js (r128, desde cdnjs) con las medidas del modelo de referencia
(padelcourtsmaster.com/elite-padel-court): 10 × 20 m; 18 vidrios templados de 2 × 3 m sin marco con pinzas
(5 por fondo y 2 en cada extremo lateral); anillo principal blanco a 3 m; laterales de malla electrosoldada de
3 m en módulos de 2 m con pilares de fierro y pletinas a 1 y 2 m; una puerta de acceso grande (≈1,9 × 2,2 m) con marco blanco en el centro de cada
lateral, frente a la red; 4 amortiguadores por lado montados en los pilares de fierro; reja superior de 1 m (marcos de 2 × 1 m) solo sobre los fondos y el vértice (2 m de cada lateral);
amortiguadores montados en cada pilar lateral; cuatro postes de luz que continúan los pilares de transición con
tubo curvo y cabezal LED de 3 focos; tubo estructural inferior 80 × 40. La **Semi Panoramic** suma pilares
de transición blancos y tubo circular de 2,5" en las cuatro esquinas. Se rota arrastrando, se acerca con la
rueda o pellizcando y doble clic vuelve a la vista inicial (de frente al lateral, con la cancha completa). Colores editables: césped, postes de
luz y amortiguadores. Escenario según la instalación: **Outdoor** con cielo y sol (sombras suaves) e **Indoor**
oscuro con la luz de los cuatro focos LED y sombras leves.

## Línea gráfica ATILA

El perfil Atila Argentina sigue la línea de atilapadel.com: fondo #0d0d0d, texto #f2f2f2, acento menta
#41d7a7, títulos livianos en mayúsculas, bordes finos y esquinas rectas. La web usa Praktika (tipografía
comercial); la maqueta usa Saira de Google Fonts como alternativa libre. Logos en `maqueta/marca/`
(versión blanca para fondo negro y versión oscura para fondo blanco).

## Imágenes de referencia

La maqueta ya no usa las renders 2D; quedan como referencia. `maqueta/canchas/` contiene las renders (tomadas de padelcourtsmaster-frontend.vercel.app/es-cl/pistas/)
y una máscara por imagen (canal R = pasto, G = amortiguadores / perfiles, B = poste de luz), generadas con
`generar_mascaras.py`. La maqueta las lleva incrustadas en `index.html` y recolorea en el navegador
conservando la luminancia original (luces y sombras).

## Foto del amortiguador

`maqueta/amortiguador/` contiene la foto original, el recorte cuadrado usado (solo el amortiguador
principal) y la máscara de sus piezas amarillas (generada con `generar_mascara.py`). Igual que las canchas,
se recolorea en el navegador conservando la luminancia; la tuerca dorada del resorte queda fuera de la máscara.

## Usuarios iniciales de la maqueta

| Usuario | Contraseña | Rol | Negocios |
| --- | --- | --- | --- |
| admin | Admin2026! | Super administrador | Todos |
| atila | Atila2026! | Usuario | Atila Argentina |
| europa | Europa2026! | Usuario | Padel Europa |

En la maqueta los usuarios y la sesión se guardan en el navegador (contraseñas con hash SHA-256), así que
**no es seguridad real**: sirve para validar el flujo. En la versión real la autenticación va en el backend
.NET (ASP.NET Core Identity o equivalente, contraseñas con hash en Neon, sesión emitida por el servidor y
permisos validados en cada llamada a la API).

## Arquitectura prevista (no implementada todavía)

- **Backend:** .NET 10 (ASP.NET Core Minimal API) + EF Core con Npgsql.
- **Frontend:** Blazor WebAssembly (o el front que se defina).
- **Base de datos:** Neon (PostgreSQL serverless). Tablas base: `usuarios`, `usuario_negocios`, `perfiles`, `modelos`,
  `negocios`, `negocio_eventos`, `proyectos`, `proyecto_etapas`, `proyecto_eventos`,
  `disenos_cancha`, `ubicaciones`, `clientes`, `cotizaciones`, `cotizacion_items`, `archivos`.
- **Despliegue:** Vercel. Vercel no tiene un runtime nativo para .NET; la opción
  habitual es publicar el frontend Blazor WebAssembly como sitio estático en Vercel y
  alojar la API .NET en un contenedor (o usar un runtime comunitario). Se decide al
  pasar de la maqueta al desarrollo.
- **Mapa real:** Leaflet/MapLibre con geocodificación por ciudad y comuna (la maqueta
  usa un contorno esquemático).

## Ver la maqueta

Abrir `maqueta/index.html` en el navegador.
