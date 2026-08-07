# Diseño UX/UI — LicitIA

Estética inspirada en Notion, ChatGPT, Linear, Vercel y Microsoft Copilot: superficies limpias, tipografía contenida, acento índigo, densidad de información alta sin ruido.

## Sistema de diseño

- **Tokens HSL** estilo shadcn/ui en `globals.css` — modo **claro y oscuro** completos (`.dark` en `<html>`, persistido en localStorage, respeta `prefers-color-scheme` la primera vez).
- **Componentes base** (`components/ui/`): Button (5 variantes CVA), Card, Input/Textarea, Badge (con mapa `statusVariant` que unifica semáforos y estados en toda la app), Table, Tabs.
- **Color semántico**: verde = cumplido/procesado, ámbar = parcial/procesando/pendiente, rojo = error/crítico/fuera de alcance, índigo = acción primaria/adicional.
- **Responsive**: grid fluido (`sm/lg/xl`), sidebar colapsable a 56 px, tablas con scroll horizontal propio, chat a altura completa en móvil.

## Navegación

```
Login ─► Dashboard (KPIs desplegables, distribución por tipo, últimos documentos)
          ├─ Documentos (carpetas por cliente + listado con filtros y borrado)
          │   ├─ Carpeta de proyecto ──► documentos del proyecto
          │   └─ Ficha de documento
          │        ├─ Resumen ejecutivo (+ exportar)
          │        ├─ Sistemas → funcionalidades (checklist, % cumplimiento, plazos)
          │        ├─ Puntos críticos (garantías, servidores, SLA, plazos, multas, certificados)
          │        ├─ Variables técnicas (tabla + confianza)
          │        ├─ Línea de tiempo interactiva
          │        ├─ Chat IA del documento (citas + confianza, selector de motor)
          │        ├─ Comentarios (con archivos adjuntos)
          │        └─ Versiones
          ├─ Subir (drag & drop multiarchivo, progreso del pipeline)
          ├─ Chat IA (biblioteca completa, 5 agentes, historial lateral)
          ├─ Comparador
          │   ├─ Checklist vs Excel (plantilla descargable, extras destacados)
          │   └─ Comparar dos documentos (semáforo / diferencias)
          ├─ Reclamos ──► Ficha del reclamo (análisis + respuestas guardadas)
          └─ Búsqueda (híbrida con filtros)
```

- **Documentos y Carpetas son una sola sección**: eran la misma información vista de dos maneras y tenerlas separadas en el menú obligaba a elegir un ángulo antes de saber qué se buscaba. Las carpetas quedan arriba como índice; el listado plano con filtros, debajo.
- **Los KPIs del dashboard son botones**: cada uno despliega su contenido bajo la fila (qué documentos, qué clientes, qué falta por procesar, avance del checklist por documento). Un número sin su detalle no permite actuar.

- **Sidebar** colapsable con estado activo, correo del usuario, toggle de tema y logout.
- **Filtros URL-driven** en Documentos (`?q=&tipo=&estado=&page=`): compartibles y con botón atrás funcional.
- **Historial de chat**: buscar, reabrir (continúa el hilo), duplicar, favoritas (orden priorizado).

## Patrones clave

1. **Confianza visible**: toda afirmación de la IA muestra cita textual + página + sección + % de confianza. El usuario nunca debe confiar a ciegas.
2. **Progreso honesto**: durante el procesamiento, el badge muestra el paso real (`procesando: embeddings`), no un spinner genérico.
3. **Estados vacíos accionables**: cada pantalla vacía dice qué hacer a continuación (con enlace).
4. **Errores recuperables**: fallos del pipeline muestran el mensaje y ofrecen reprocesar; fallos de chat quedan en el hilo sin perder la conversación.
5. **Exportar donde se mira**: los botones PDF/Word/Excel/PPT/CSV viven junto al contenido exportable (resumen, variables, requerimientos, comparación).

## Visor de PDF sincronizado (diseño)

La ficha entrega `GET /api/documents/:id/file` (URL firmada). La iteración siguiente monta `react-pdf` en un panel lateral del chat: cada cita es clicable y hace scroll a la página referenciada (`pagina` ya viaja en cada cita). El modelo de datos y la API ya lo soportan; ver roadmap.
