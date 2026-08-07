# Formato del Excel de control de entregas

El comparador enfrenta el **checklist de sistemas** extraído del documento técnico (licitación, bases técnicas o contrato) contra **un archivo Excel** en el que tu equipo lleva el control de lo realmente entregado.

Para que la comparación sea exacta y no dependa de la interpretación de un modelo de IA, ese Excel debe seguir el formato de abajo.

> **Atajo recomendado:** en la pantalla del comparador, elige el documento base y pulsa **“Descargar plantilla Excel”**. Obtendrás este mismo formato ya pre-llenado con todos los sistemas y funcionalidades del documento — solo tienes que completar las columnas de la derecha y agregar al final lo que hayas entregado de más.

## Hoja

La tabla debe estar en la hoja llamada **`Control de entregas`**. Si el archivo tiene una sola hoja con otro nombre, también se lee.

## Columnas

La fila de encabezados debe contener exactamente estos nombres (puede haber filas de título por encima; el sistema busca la fila que contiene `Sistema` y `Funcionalidad`):

| Columna | Obligatoria | Valores aceptados | Para qué sirve |
|---|---|---|---|
| **Sistema** | Sí | Texto libre | Agrupa las funcionalidades. Puedes escribirlo solo en la primera fila del grupo y dejarlo en blanco en las siguientes. |
| **Funcionalidad** | Sí | Texto libre | Lo que se entregó, en una línea. Es la columna con la que se emparejan las funcionalidades del documento base. |
| **Estado** | No | `Entregado` · `En desarrollo` · `Pendiente` | Determina el % de cumplimiento. Si se deja vacío se asume `Pendiente`. |
| **Fecha entrega** | No | `AAAA-MM-DD` o fecha de Excel | Cuándo se entregó. |
| **Plazo comprometido** | No | Texto libre (`60 días desde la firma`) | Solo informativo; si está vacío se usa el plazo que trae el documento base. |
| **Adicional** | No | `Sí` / `No` | Marca el trabajo que **no** estaba comprometido. |
| **Sin costo** | No | `Sí` / `No` | Marca el trabajo entregado **sin cobro** al cliente. |
| **Observaciones** | No | Texto libre | Contexto, número de acta, quién lo pidió, etc. |

Cualquier otra columna que agregues se ignora sin dar error.

## Ejemplo

| Sistema | Funcionalidad | Estado | Fecha entrega | Plazo comprometido | Adicional | Sin costo | Observaciones |
|---|---|---|---|---|---|---|---|
| Portal de Atención Ciudadana | Emitir certificado de residencia en PDF | Entregado | 2026-03-14 | 60 días desde la firma | No | No | |
| Portal de Atención Ciudadana | Pago en línea con Webpay | En desarrollo | | | No | No | A la espera de credenciales del cliente |
| Portal de Atención Ciudadana | Notificación por WhatsApp | Entregado | 2026-04-02 | | Sí | Sí | Solicitado en reunión del 12-03, sin cobro |
| Módulo de Tesorería | Conciliación bancaria automática | Pendiente | | | No | No | |

## Cómo se compara

1. Cada funcionalidad del documento base busca su mejor coincidencia entre las filas del Excel. El emparejamiento es por **similitud de palabras**, no por texto idéntico: `Emitir certificado de residencia en PDF` empareja con `Emisión de certificados de residencia (PDF)`.
2. Si no encuentra coincidencia, la funcionalidad se marca **Ausente** — está comprometida y no aparece en tu control.
3. Las filas del Excel que no se emparejaron con ninguna funcionalidad exigida se listan aparte y **se destacan** como trabajo adicional, señalando cuáles se hicieron sin costo. Es el respaldo para negociaciones y para responder reclamos.
4. El **% de cumplimiento** se calcula sobre las funcionalidades del documento base en estado `Entregado`. Lo adicional se cuenta aparte: no infla el porcentaje.

## Errores frecuentes

| Mensaje | Causa | Solución |
|---|---|---|
| «Formato no reconocido: falta la fila de encabezados…» | La hoja no tiene las columnas `Sistema` y `Funcionalidad`. | Descarga la plantilla desde el comparador. |
| «No se encontró ninguna fila con funcionalidad» | La columna `Funcionalidad` está vacía en todas las filas. | Completa al menos esa columna. |
| «No se pudo leer el archivo» | El archivo es `.xls` antiguo, `.csv` o está dañado. | Guárdalo como `.xlsx` desde Excel o Google Sheets. |
| El documento base aparece sin sistemas | El documento no se ha procesado, o su análisis no detectó sistemas. | Procesa el documento y revisa la pestaña **Sistemas** de su ficha. |
