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
| Usuarios y permisos | Solo super administrador: usuarios internos, negocios, rol, **módulos visibles** (perfiles Gerencia, Comercial, Operaciones, Solo seguimiento o selección uno a uno), activar/desactivar, nueva contraseña y eliminar. Cada usuario ve en el menú solo sus módulos. Siempre queda al menos un super administrador activo. |
| Registro de sesiones | Solo super administrador: cuándo ingresa y sale cada usuario (equipo y clientes), cuántas veces ingresa, tiempo conectado, quién está conectado ahora, equipo y navegador. Filtros por usuario y período. |
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
luz y amortiguadores. El logo del cliente se dibuja en ambas caras de cada puerta y en las caras de los amortiguadores, siempre al derecho y sin espejarse, desde cualquier ángulo de giro. Escenario según la instalación: **Outdoor** con cielo y sol (sombras suaves) e **Indoor**
oscuro con la luz de los cuatro focos LED y sombras leves.

## Sesiones e inactividad

Cada ingreso abre una sesión (tabla `sesiones` en Neon: inicio, última actividad, salida, motivo, IP y navegador).
La sesión se cierra con el botón **Salir** o, si no hay clics ni teclas durante **1 hora**, se cierra sola: la página
cierra la sesión y vuelve al ingreso, y el servidor también la da por cerrada (a la hora de la última actividad) aunque
el navegador se haya cerrado. El siguiente ingreso cuenta como uno nuevo. Mientras el usuario trabaja, la página avisa
actividad al servidor cada 5 minutos como máximo (`api/actividad`).

## Compartir y proteger cotizaciones

Al enviar una cotización el equipo puede:

- **Compartirla** con otros clientes del portal (casillas en la cotización). Ellos la ven en «Mis cotizaciones», pero solo el cliente dueño del negocio puede aceptarla.
- **Protegerla con clave**: el sistema genera una clave (se muestra una sola vez para copiarla o enviarla) y guarda solo su hash SHA-256 con sal. La cotización llega al portal sin precios ni ítems hasta que se ingresa la clave, y también se puede abrir con el enlace `/?cot=<id>` + clave. Se puede generar una nueva clave o quitar la protección. El equipo interno la ve siempre.

La validación de la clave se hace en el servidor (`api/cotizacion`), con espera ante claves incorrectas.

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

## Usuarios iniciales de la maqueta (solo en modo local)

| Usuario | Contraseña | Rol | Negocios |
| --- | --- | --- | --- |
| admin | Admin2026! | Super administrador | Todos |
| atila | Atila2026! | Usuario | Atila Argentina |
| europa | Europa2026! | Usuario | Padel Europa |

En la maqueta los usuarios y la sesión se guardan en el navegador (contraseñas con hash SHA-256), así que
**no es seguridad real**: sirve para validar el flujo. En la versión real la autenticación va en el backend
.NET (ASP.NET Core Identity o equivalente, contraseñas con hash en Neon, sesión emitida por el servidor y
permisos validados en cada llamada a la API).

## Publicación (Vercel + Neon)

- **Sitio:** https://atila-gestion-canchas.vercel.app (proyecto Vercel `atila-gestion-canchas`, equipo EDS's projects).
- **Base de datos:** Neon, proyecto `atila-gestion-canchas` (región São Paulo). Tablas: `usuarios`
  (contraseñas con scrypt), `sesiones` (ingresos y salidas), `entidades` (modelos, negocios y proyectos como JSON) y `meta` (numeración de cotizaciones).
- **API** (`api/`, funciones Node en Vercel): `ping`, `login`, `bootstrap` (carga inicial según el rol),
  `state` (guardado por cambios), `cotizacion` (abre una cotización protegida con su clave), `logout`, `actividad`, `sesiones` (registro, solo super administrador) y `users` (administración de usuarios y cambio de contraseña). La sesión es un
  token firmado de 12 horas. Los permisos se validan en el servidor: los clientes solo ven y modifican sus propias
  solicitudes (en las suyas solo pueden aceptar cotizaciones) y las cotizaciones compartidas con ellos; solo el super administrador administra usuarios internos; el equipo administra clientes.
- **Variables de entorno en Vercel:** `DATABASE_URL` (Neon) y `SESSION_SECRET`. No están en el repositorio.
- **Despliegue:** `build.js` envuelve `maqueta/index.html` en `public/index.html`. La misma página detecta si corre en
  Vercel (responde `/api/ping`) y usa la base de datos; fuera de Vercel funciona con datos locales del navegador.
- **Pendiente:** los permisos por módulo se aplican en la interfaz, todavía no en la API; los archivos (logo, mapa)
  se guardan dentro de la base de datos (máx. 2 MB c/u) y conviene moverlos a un almacenamiento de archivos.

## Arquitectura

Se publicó con funciones Node.js en Vercel en lugar de .NET, porque Vercel no ejecuta .NET de forma nativa.
Si se requiere .NET 10, la API puede reescribirse en ASP.NET Core sobre las mismas tablas de Neon y alojarse en un
servicio de contenedores, manteniendo el frontend en Vercel.

## Ver la maqueta

Abrir `maqueta/index.html` en el navegador.
