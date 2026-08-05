# Manual de Usuario — LicitIA

## 1. Ingreso

Entra con el correo y contraseña que te asignó tu administrador. El sistema tiene tres roles:

- **Administrador**: ve todo, gestiona usuarios, permisos, etiquetas y configuración; único que puede eliminar documentos y ver auditoría.
- **Supervisor**: ve todos los documentos de la organización y gestiona clientes y permisos.
- **Usuario**: ve solo los documentos que subió o que le fueron autorizados.

Con el botón de la barra lateral puedes colapsar el menú y cambiar entre modo claro y oscuro.

## 2. Subir documentos

**Subir** → arrastra tus archivos (PDF, Word, Excel, TXT, PowerPoint o ZIP; máx. 50 MB) o haz clic para seleccionarlos.

Al subir, la plataforma automáticamente:
1. Guarda el archivo original de forma segura.
2. Extrae el texto — si el PDF es escaneado, aplica **OCR** sin que hagas nada.
3. **Clasifica** el documento: cliente, tipo, número de licitación, ID Mercado Público, fecha, monto, duración, región, idioma, etc.
4. Genera el **resumen ejecutivo** (objetivo, alcance, riesgos, obligaciones, entregables, recomendaciones…).
5. Extrae **variables técnicas** (sistemas, módulos, integraciones, SLA, multas, garantías…) y **requerimientos** individuales.
6. Construye la **línea de tiempo** del proyecto.

El estado del procesamiento se ve en la tabla de Documentos (p. ej. “procesando: embeddings”). Un ZIP crea un documento por cada archivo que contiene.

## 3. Ficha de documento

Pestañas disponibles:
- **Resumen**: informe ejecutivo completo, exportable a PDF/Word/Excel/PPT/CSV.
- **Metadatos**: la clasificación automática.
- **Variables / Requerimientos**: tablas con página de origen y confianza de la IA.
- **Línea de tiempo**: hitos interactivos (clic para ver detalle y cita textual).
- **Chat IA**: pregunta lo que quieras sobre el documento (ver §4).
- **Notas**: comentarios, observaciones, pendientes y recordatorios con fecha.
- **Versiones**: historial de versiones del documento.

## 4. Chat IA

Pregunta en lenguaje natural: *“¿Qué sistemas solicita esta licitación?”, “¿Qué multas contempla?”, “¿Qué personal mínimo exige?”*.

Cada respuesta incluye **citas textuales con página y sección** y un **porcentaje de confianza**. Si la información no está en el documento, el asistente lo dirá — nunca inventa.

En **Chat IA** (menú lateral) consultas toda la biblioteca a la vez (*“¿Qué municipalidades piden integración con Tesorería?”*) y eliges agente especializado: Analista, Comparador, Redactor de Reclamos, Generador de Propuestas o Asesor Comercial. Tus conversaciones se guardan: reábrelas, continúalas, márcalas favoritas ⭐, duplícalas o búscalas.

## 5. Control de cumplimiento

Este es el corazón del sistema: **control interno de lo comprometido vs. lo realmente entregado**.

1. Mantén tu propio **documento de control de entregas** (Word/Excel/PDF con lo que realmente has entregado, en curso o comprometido — incluidos trabajos que hiciste de más) y súbelo como cualquier documento. El sistema lo clasifica como `control_entregas` y extrae cada entrega individual; las verás en la pestaña **Entregas** de su ficha, marcadas como contractuales, adicionales o adicionales **sin costo**.
2. En **Control de cumplimiento**, elige el documento base (la licitación, las bases técnicas o el contrato) y tu documento de control, y pulsa **Comparar**.
3. Obtendrás dos análisis:
   - **Cumplimiento contractual**: cada requerimiento del documento base clasificado como cumplido, parcial o pendiente según la evidencia de tu control, con porcentajes y **semáforo** verde/amarillo/rojo, evidencia, página, comentario IA, riesgo y prioridad.
   - **Trabajos adicionales fuera de acuerdo**: la pasada inversa detecta entregas tuyas que no responden a ningún requerimiento del acuerdo — incluyendo las realizadas **gratuitamente**. Este registro es tu mejor respaldo en negociaciones y respuestas a reclamos.

También puedes comparar diferencias entre dos licitaciones, propuestas, contratos o versiones.

## 6. Reclamos

1. Pega el correo de reclamo del cliente y pulsa **Analizar reclamo**.
2. La IA identifica qué reclama, qué solicita, qué contrato aplica, qué ya está entregado, qué está pendiente y qué está fuera del contrato — todo contrastado con tus documentos.
3. Pulsa **Redactar respuesta**: obtendrás un borrador profesional, argumentado y con evidencia citada. **Revisa siempre el borrador antes de enviarlo.**

## 7. Búsqueda inteligente

**Búsqueda** entiende conceptos, no solo palabras exactas: *“licitaciones que exijan firma electrónica”* encontrará también “FEA” o “Ley 19.799”. Filtra por tipo de documento y haz clic en un resultado para abrir el documento en la página citada.

## 8. Preguntas frecuentes

- **Mi documento quedó en “error”** → abre la ficha, revisa el mensaje y usa reprocesar; si persiste, contacta a tu administrador.
- **No veo un documento** → pide a un supervisor/administrador que te autorice (permisos por documento).
- **¿La IA puede equivocarse?** → Sí; por eso toda respuesta trae citas y confianza. Verifica la cita en el documento original ante decisiones importantes.
