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
| Ingreso | Usuario y contraseña. Cada usuario ve solo los negocios que tiene asignados (Atila Argentina, Padel Europa o ambos). |
| Usuarios y permisos | Solo para el super administrador: crear usuarios, asignar negocios, cambiar rol, activar/desactivar, poner nueva contraseña y eliminar. Siempre queda al menos un super administrador activo. Cada usuario puede cambiar su propia contraseña. |
| Perfiles | Selector Atila Argentina / Padel Europa, visible solo si el usuario tiene acceso a ambos (Europa queda vacío hasta definir sus módulos). |
| Bandeja de negocios | Negocios en gestión comercial (nuevo → calificado → propuesta → negociación). Al **cerrar la venta** se crea el proyecto y se copia el historial (trazabilidad). |
| Proyectos y entregas | Listado de proyectos en tarjetas coloreadas por estado (por iniciar, en construcción, saliendo / en tránsito, en instalación, habilitada, con atraso); al abrir uno se ve en página completa: línea de tiempo (Gantt) con etapas: venta cerrada, en construcción, salida y transporte, entrega en obra, instalación, cancha habilitada. Etapas atrasadas en rojo, fechas editables, bitácora. |
| Calendario y mapa | En una sola vista: mapa de Argentina con todos los proyectos (zoom con rueda, doble clic, pellizco o botones; arrastre para moverse; al acercarse se lee cada proyecto con su cantidad de canchas, modelo y etapa) y calendario mensual de hitos. Al tocar un proyecto, el mapa se acerca a él y el calendario muestra solo ese proyecto. |
| Diseño de cancha | Renders reales de los tres tipos de cancha ATILA (Competition PRO = Full Vision, Atila PRO = Elite Pro, Atila Estándar = Panoramic). Solo se cambia el color del césped. Debajo: **amortiguadores** (ilustración del amortiguador ATILA que se pinta con la carta RAL Classic completa, con búsqueda por código o nombre y color libre) y **archivos del proyecto**: logo para la cancha (indicando si va en los amortiguadores y/o sobre las puertas) y mapa del proyecto (imagen, PDF o DWG/DXF, hasta 2 MB). Todo se guarda en el proyecto y se ve en su ficha. |
| Tipos de cancha | Los tres tipos ATILA (Competition PRO, Atila PRO, Atila Estándar) con nombre y descripción editables. |

## Línea gráfica ATILA

El perfil Atila Argentina sigue la línea de atilapadel.com: fondo #0d0d0d, texto #f2f2f2, acento menta
#41d7a7, títulos livianos en mayúsculas, bordes finos y esquinas rectas. La web usa Praktika (tipografía
comercial); la maqueta usa Saira de Google Fonts como alternativa libre. Logos en `maqueta/marca/`
(versión blanca para fondo negro y versión oscura para fondo blanco).

## Imágenes de las canchas

`maqueta/canchas/` contiene las renders (tomadas de padelcourtsmaster-frontend.vercel.app/es-cl/pistas/)
y una máscara por imagen (canal R = pasto, G = amortiguadores / perfiles, B = poste de luz), generadas con
`generar_mascaras.py`. La maqueta las lleva incrustadas en `index.html` y recolorea en el navegador
conservando la luminancia original (luces y sombras).

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
  `disenos_cancha`, `ubicaciones`.
- **Despliegue:** Vercel. Vercel no tiene un runtime nativo para .NET; la opción
  habitual es publicar el frontend Blazor WebAssembly como sitio estático en Vercel y
  alojar la API .NET en un contenedor (o usar un runtime comunitario). Se decide al
  pasar de la maqueta al desarrollo.
- **Mapa real:** Leaflet/MapLibre con geocodificación por ciudad y comuna (la maqueta
  usa un contorno esquemático).

## Ver la maqueta

Abrir `maqueta/index.html` en el navegador.
