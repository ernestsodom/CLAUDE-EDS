# Manual de Usuario — LicitIA

## 1. Ingreso

Entra con el correo y contraseña que te asignó tu administrador. El sistema tiene tres roles:

- **Administrador**: ve todo, gestiona usuarios, permisos, etiquetas y configuración; único que ve la auditoría.
- **Supervisor**: ve todos los documentos de la organización y gestiona clientes y permisos.
- **Usuario**: ve solo los documentos que subió o que le fueron autorizados.

Puedes **eliminar** un documento si lo subiste tú (o si eres supervisor o administrador): botón **Eliminar** en la ficha del documento y en cada fila del listado. El borrado es definitivo y se lleva el archivo, el análisis, el checklist y los comentarios asociados, por eso pide confirmación.

Con el botón de la barra lateral puedes colapsar el menú y cambiar entre modo claro y oscuro.

Al entrar caes en el **Dashboard**. Los indicadores de arriba —Documentos, Clientes, Licitaciones, Pendientes, Sistemas, Puntos críticos y Monto total— **son botones**: pulsa cualquiera y se despliega su contenido justo debajo, con enlaces directos. Así, «12 pendientes» te dice *cuáles* y por qué, y «Sistemas 43 %» te muestra el avance documento por documento.

## 2. Subir documentos

**Subir** → arrastra tus archivos (PDF, Word, Excel, TXT, PowerPoint o ZIP; máx. 50 MB) o haz clic para seleccionarlos.

Antes de subir puedes elegir la **carpeta de destino** (cliente/proyecto) o crearla ahí mismo con el botón **Nueva carpeta** (nombre del cliente + nombre del proyecto). Las carpetas viven dentro de **Documentos** (menú lateral): arriba las verás agrupadas por cliente y, al abrir una, todo lo relacionado a ese proyecto — licitación, bases, contrato, control de entregas, actas y reclamos. Debajo de las carpetas está el listado completo con filtros.

### Motor de análisis

Justo antes de subir eliges con qué **motor** se analizará el documento — tú decides, nada cambia de motor sin que lo veas:

- **Gemini** / **Groq** (solo aparecen si el administrador configuró su API key): análisis interpretativo completo, **gratuitos**. Si ese proveedor se queda sin cuota, el documento queda marcado con el error correspondiente — no cambia de motor por su cuenta.
- **Claude Haiku 4.5** (solo aparece si está configurado): el mismo análisis interpretativo, con el modelo de Anthropic. Se distingue con la marca **«· de pago»** en el propio botón: a diferencia de Gemini y Groq, se cobra por uso desde el primer documento. Elígelo cuando quieras su calidad de análisis en un caso puntual.
- **Automático**: prueba los proveedores **gratuitos** configurados en orden y, si todos se quedan sin cuota, continúa solo en modo local. Nunca elige Claude por su cuenta — eso solo ocurre si lo seleccionas tú mismo. Es la opción recomendada para no preocuparte de los límites de cada proveedor gratuito.
- **Sin IA**: extracción por patrones (número de licitación, montos, plazos, organismo, cláusulas obligatorias, integraciones, garantías, multas…). Instantánea y **no consume cuota de ningún proveedor** — úsala cuando se te acaben los créditos o para procesar volumen rápidamente.

Este mismo selector aparece en cada análisis del sistema: al subir o reprocesar un documento, en el **Comparador**, al analizar y redactar la respuesta de un **Reclamo**, y en el **Chat IA**. El motor que analizó cada etapa queda registrado y visible (p. ej. “clasificando · licitación (Groq)”). Puedes volver a analizar un documento ya subido con otro motor desde su ficha, sin perder lo ya extraído.

Al subir, la plataforma automáticamente:
1. Guarda el archivo original de forma segura.
2. Extrae el texto — si el PDF es escaneado, aplica **OCR** sin que hagas nada.
3. **Clasifica** el documento: cliente, tipo, número de licitación, ID Mercado Público, fecha, monto, duración, región, idioma, etc.
4. Genera el **resumen ejecutivo** (objetivo, alcance, riesgos, obligaciones, entregables, recomendaciones…).
5. Extrae **variables técnicas** (integraciones, SLA, multas, garantías…).
6. Identifica los **sistemas** exigidos y las **funcionalidades** de cada uno, con su plazo → es el checklist (ver §3).
7. Extrae los **puntos críticos** para participar: boleta de garantía, condiciones de servidores, SLA, plazos, multas y certificados.
8. Construye la **línea de tiempo** del proyecto.

El estado del procesamiento se ve en la tabla de Documentos (p. ej. “procesando: embeddings”). Un ZIP crea un documento por cada archivo que contiene.

## 3. Ficha de documento

Bajo el título verás los datos de clasificación (tipo, número, fecha, monto, duración, páginas). Pestañas disponibles:

- **Resumen**: informe ejecutivo completo, exportable a PDF/Word/Excel/PPT/CSV.
- **Sistemas**: el **checklist de cumplimiento**. Cada sistema es un botón: al pulsarlo se despliegan sus funcionalidades. Marca el check de cada funcionalidad al completarla y fija su **plazo** con el selector de fecha; el **% de cumplimiento** se actualiza al instante, por sistema y para todo el documento. Lo que marques se guarda solo y **no se pierde si vuelves a procesar el documento**.
- **Puntos críticos**: solo lo obligatorio para participar —boleta de garantía, condiciones de servidores, SLA, plazos, multas y certificados— agrupado por tipo y con la cita textual. Las funcionalidades del software no están aquí: están en **Sistemas**.
- **Variables**: elementos técnicos detectados, con página de origen y confianza de la IA.
- **Línea de tiempo**: hitos interactivos (clic para ver detalle y cita textual).
- **Chat IA**: pregunta lo que quieras sobre el documento (ver §4).
- **Comentarios**: comentarios, observaciones, pendientes y recordatorios con fecha, y **archivos adjuntos** (actas, correos, capturas — cualquier formato). Pulsa un adjunto para descargarlo.
- **Versiones**: historial de versiones del documento.

## 4. Chat IA

Pregunta en lenguaje natural: *“¿Qué sistemas solicita esta licitación?”, “¿Qué multas contempla?”, “¿Qué personal mínimo exige?”*.

Cada respuesta incluye **citas textuales con página y sección** y un **porcentaje de confianza**. Si la información no está en el documento, el asistente lo dirá — nunca inventa.

Bajo el cuadro de escritura eliges el **motor** que responde: **Gemini**, **Groq** o **Claude Haiku 4.5** (aparecen solo los que tu administrador configuró). Como en el análisis de documentos, el motor lo eliges tú: nunca cambia solo.

En **Chat IA** (menú lateral) consultas toda la biblioteca a la vez (*“¿Qué municipalidades piden integración con Tesorería?”*) y eliges agente especializado: Analista, Comparador, Redactor de Reclamos, Generador de Propuestas o Asesor Comercial. Tus conversaciones se guardan: reábrelas, continúalas, márcalas favoritas ⭐, duplícalas o búscalas.

## 5. Control de cumplimiento

Este es el corazón del sistema: **control interno de lo comprometido vs. lo realmente entregado**. Hay dos formas de llevarlo, y puedes usar ambas.

### 5.1 El checklist del documento (día a día)

Abre la licitación o las bases técnicas → pestaña **Sistemas**. Ahí está todo lo que te comprometiste a entregar, ordenado por sistema. Despliega un sistema, marca las funcionalidades a medida que las entregas y fija sus plazos. El % de cumplimiento es siempre el real, sin que tengas que llevar la cuenta aparte.

### 5.2 Comparar contra tu Excel de control (revisiones y cierres)

Cuando lo que necesitas es cruzar el compromiso con **tu propia planilla** de control de entregas:

1. Ve a **Comparador** → pestaña **Checklist vs Excel**.
2. Elige el **documento base** (licitación, bases técnicas o contrato): puedes buscarlo entre los ya subidos o subir uno nuevo ahí mismo.
3. Pulsa **Descargar plantilla Excel**. Baja un archivo ya pre-llenado con todos los sistemas y funcionalidades del documento, en el formato que el comparador entiende.
4. Complétalo: estado de cada funcionalidad (`Entregado` / `En desarrollo` / `Pendiente`), fecha, y —lo importante— **agrega al final las filas de todo lo que entregaste de más**, marcando `Adicional` y `Sin costo`.
5. Súbelo y pulsa **Comparar**.

> El segundo archivo debe ser **siempre un Excel `.xlsx` con ese formato**. El detalle completo de las columnas, con ejemplos y los errores frecuentes, está en la pantalla **Ver el formato** (enlace en el propio comparador). La comparación es instantánea y **no consume cuota de IA**.

El resultado te muestra:
- **% de cumplimiento** calculado solo sobre lo comprometido.
- Cada funcionalidad exigida con su estado; las que tu Excel no menciona salen marcadas **Ausente**.
- Un bloque **destacado** con todo lo que aparece en tu Excel y el documento base **no exige**: los trabajos adicionales, señalando cuáles hiciste **sin costo**. Ese registro es tu mejor respaldo en negociaciones y al responder reclamos.

### 5.3 Comparar dos documentos

En la pestaña **Comparar dos documentos** sigues teniendo la comparación clásica: cumplimiento contra un documento de control ya analizado por IA, o diferencias entre dos licitaciones, propuestas, contratos o versiones.

## 6. Reclamos

1. Pega el correo de reclamo del cliente (opcionalmente ponle un asunto) y pulsa **Analizar y guardar reclamo**.
2. La IA identifica qué reclama, qué solicita, qué contrato aplica, qué ya está entregado, qué está pendiente y qué está fuera del contrato — todo contrastado con tus documentos. **El reclamo queda guardado**: no se pierde al cerrar la pantalla.
3. Abre su ficha (botón **Abrir ficha del reclamo**, o desde la lista **Reclamos recientes**, donde cada reclamo es un enlace). Ahí ves el correo original, el análisis completo y todas las respuestas.
4. Pulsa **Redactar respuesta** para generar un borrador profesional con evidencia citada. **Edítalo dentro de la misma ficha y pulsa Guardar**: los cambios quedan registrados. Puedes redactar varias versiones y marcar como **Aprobada** la que finalmente enviaste.

**Revisa siempre el borrador antes de enviarlo.**

## 7. Búsqueda inteligente

**Búsqueda** entiende conceptos, no solo palabras exactas: *“licitaciones que exijan firma electrónica”* encontrará también “FEA” o “Ley 19.799”. Filtra por tipo de documento y haz clic en un resultado para abrir el documento en la página citada.

## 8. Preguntas frecuentes

- **Mi documento quedó en “error”** → abre la ficha, revisa el mensaje y usa reprocesar; si persiste, contacta a tu administrador.
- **No veo un documento** → pide a un supervisor/administrador que te autorice (permisos por documento).
- **¿La IA puede equivocarse?** → Sí; por eso toda respuesta trae citas y confianza. Verifica la cita en el documento original ante decisiones importantes.
- **La pestaña Sistemas está vacía** → el documento no se ha procesado, o su análisis no detectó sistemas (típico en bases administrativas, que no describen software). Procésalo o vuelve a procesarlo con otro motor desde su ficha.
- **El comparador rechaza mi Excel** → el mensaje dice exactamente qué falta. La solución casi siempre es descargar la plantilla desde el comparador y trabajar sobre ella; el formato completo está en **Ver el formato**.
- **Marqué funcionalidades y reprocesé el documento, ¿pierdo el avance?** → No. Las marcas se conservan al reprocesar.
