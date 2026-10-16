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
| Proyectos y entregas | Línea de tiempo (Gantt) por proyecto con etapas: venta cerrada, en construcción, salida y transporte, entrega en obra, instalación, cancha habilitada. Etapas atrasadas en rojo, fechas editables, bitácora. |
| Calendario | Vista mensual con los hitos de todas las entregas, filtrable por proyecto. |
| Mapa de Argentina | Proyectos ubicados por provincia / ciudad / comuna, coloreados por etapa. |
| Diseño de cancha | Vista 3D de la cancha: modelo, tipo (panorámica / semi / estándar, según el modelo), personalización con logo, color de pasto, postes de luz, amortiguadores de perfiles y estructura. |
| Modelos | Nombres editables (Atila Panorámica, Atila PRO, Atila Clásica, Atila Básica) y asignación del tipo. |

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
