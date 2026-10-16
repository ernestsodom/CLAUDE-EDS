# Gestión de canchas — Atila Argentina / Padel Europa

Plataforma para controlar dos negocios con perfiles separados. Esta carpeta contiene,
por ahora, **solo la maqueta navegable** (`maqueta/index.html`, un único archivo HTML
sin dependencias de compilación). Los datos son de ejemplo y se guardan en el
`localStorage` del navegador.

## Qué cubre la maqueta

| Módulo | Qué muestra |
| --- | --- |
| Perfiles | Selector Atila Argentina / Padel Europa (Europa queda vacío hasta definir sus módulos). |
| Bandeja de negocios | Negocios en gestión comercial (nuevo → calificado → propuesta → negociación). Al **cerrar la venta** se crea el proyecto y se copia el historial (trazabilidad). |
| Proyectos y entregas | Listado de proyectos; al abrir uno se ve en página completa: línea de tiempo (Gantt) con etapas: venta cerrada, en construcción, salida y transporte, entrega en obra, instalación, cancha habilitada. Etapas atrasadas en rojo, fechas editables, bitácora. |
| Calendario y mapa | En una sola vista: mapa de Argentina con todos los proyectos (zoom con rueda, doble clic, pellizco o botones; arrastre para moverse; al acercarse se lee cada proyecto con su cantidad de canchas, modelo y etapa) y calendario mensual de hitos. Al tocar un proyecto, el mapa se acerca a él y el calendario muestra solo ese proyecto. |
| Diseño de cancha | Renders reales de cada cancha (panorámica = Full Vision, semi panorámica = Elite Pro, estándar = Panoramic). Si es personalizada se recolorean pasto, postes de luz y amortiguadores / perfiles, y se coloca el logo sobre el vidrio. |
| Modelos | Nombres editables (Atila Panorámica, Atila PRO, Atila Clásica, Atila Básica) y asignación del tipo. |

## Imágenes de las canchas

`maqueta/canchas/` contiene las renders (tomadas de padelcourtsmaster-frontend.vercel.app/es-cl/pistas/)
y una máscara por imagen (canal R = pasto, G = amortiguadores / perfiles, B = poste de luz), generadas con
`generar_mascaras.py`. La maqueta las lleva incrustadas en `index.html` y recolorea en el navegador
conservando la luminancia original (luces y sombras).

## Arquitectura prevista (no implementada todavía)

- **Backend:** .NET 10 (ASP.NET Core Minimal API) + EF Core con Npgsql.
- **Frontend:** Blazor WebAssembly (o el front que se defina).
- **Base de datos:** Neon (PostgreSQL serverless). Tablas base: `perfiles`, `modelos`,
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
