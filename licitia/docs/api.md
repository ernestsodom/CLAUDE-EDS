# API — LicitIA

Todas las rutas exigen sesión Supabase (cookie JWT) salvo `/api/internal/*`, que exige el header `x-internal-secret`. Errores homogéneos: `{ "error": { "code", "message" } }` con status HTTP correcto.

## Documentos

### `POST /api/documents/upload`
`multipart/form-data`, campo `file` (PDF/DOCX/XLSX/TXT/PPT/PPTX/ZIP, máx. 50 MB).
Crea documento + versión + archivo, sube a Storage y dispara el pipeline.
**201** → `{ documentId, versionId, status: "procesando" }`

### `POST /api/documents/:id/reprocess`
Reintenta el pipeline de la versión actual. **200** → `{ status: "procesando" }`

### `GET /api/documents/:id/file`
**200** → `{ url, fileName, mimeType }` (URL firmada 1 h).

### `DELETE /api/documents/:id`
Elimina el documento, sus archivos de Storage (incluidos los hijos de un ZIP) y, en cascada, versiones, páginas, fragmentos, análisis, checklist, comentarios y comparaciones.
Permitido a admin, supervisor o quien subió el documento. **200** → `{ deleted: true }` · **403** si RLS lo impide.

## Checklist de sistemas

### `GET /api/documents/:id/checklist/template`
Descarga el Excel con el **formato predeterminado** (`docs/formato-excel.md`), pre-llenado con los sistemas y funcionalidades del documento.
**200** → archivo `.xlsx` · **422** si el documento aún no tiene sistemas.

### `POST /api/documents/:id/checklist/compare`
`multipart/form-data`, campo `file` (`.xlsx`). Compara el checklist del documento contra el Excel de control. **Determinista: no llama a ningún proveedor de IA.**
**201** →
```json
{
  "comparisonId": "uuid",
  "systems": [{ "name", "pct", "features": [{ "name", "state", "excelRow" }] }],
  "extras":  [{ "system", "feature", "isAdditional", "isFree", "row" }],
  "totals":  { "totalFeatures", "matched", "completed", "missing", "extra", "pctCompleted", "freeExtras" }
}
```
`state` ∈ `entregado | en_desarrollo | pendiente | ausente`. Los errores de formato del Excel vuelven como **422** con el mensaje exacto que debe corregir el usuario.

El avance manual del checklist (marcar una funcionalidad como completada, fijar su plazo) se escribe directamente contra `system_features` desde el navegador con la sesión del usuario — política RLS `features_update`, sin ruta de API intermedia.

## Comentarios

### `POST /api/notes/:id/attachments`
`multipart/form-data`, campo `file`. Adjunta un archivo a un comentario propio (bucket `attachments`, sin lista blanca de MIME). **201** → `{ id, file_name, mime_type, size_bytes }`

### `GET /api/notes/attachments/:id`
**200** → `{ url, fileName, mimeType }` (URL firmada 1 h).

### `POST /api/internal/process` *(interno)*
Body: `{ documentId, versionId, organizationId, userId }`. Ejecuta el pipeline completo con service_role. maxDuration 300 s.

## Chat RAG

### `POST /api/chat` *(SSE)*
```json
{
  "conversationId": "uuid?",       // omitir para crear
  "documentId": "uuid|null",       // null = biblioteca completa
  "agent": "analista|comparador|reclamos|propuestas|comercial",
  "engine": "gemini|groq|claude",   // opcional: el primero configurado si se omite
  "question": "¿Qué multas contempla?",
  "filters": { "docType": "licitacion?", "clientId": "uuid?" }
}
```
Eventos SSE:
- `meta` → `{ conversationId, engine, model }`
- `delta` → `{ text }` (streaming del texto visible)
- `done` → `{ citations: [{chunk_id, cita_textual, pagina, seccion}], confidence, engine, model }`
- `error` → `{ message }`

Los mensajes (con citas, confianza y el modelo que respondió) quedan persistidos en `messages`.

### `GET /api/ai/chat-engines`
Motores disponibles para el chat, solo los que tienen API key configurada.
**200** → `{ engines: [{ id: "gemini"|"groq"|"claude", label }] }`

### `POST /api/conversations/:id/duplicate`
**201** → `{ conversationId }` (copia con todos los mensajes).

## Búsqueda

### `POST /api/search`
`{ query, docType?, clientId?, limit? }` →
`{ results: [{ chunk_id, document_id, document_title, snippet, page_start, section, score }] }`
Búsqueda híbrida (RRF vectorial + tsvector español) restringida a documentos autorizados.

## Comparaciones

### `POST /api/comparisons`
```json
{
  "comparisonType": "cumplimiento|licitacion_vs_licitacion|propuesta_vs_propuesta|contrato_vs_contrato|version_vs_version",
  "sourceDocumentId": "uuid",
  "targetDocumentId": "uuid"
}
```
`cumplimiento`: clasifica cada requerimiento del origen contra evidencia del destino → `comparison_items` + porcentajes + semáforo. Resto: tabla de diferencias con impacto. **201** → `{ comparisonId }` (síncrono; maxDuration 300 s).

## Reclamos

### `POST /api/claims`
`{ rawEmail, clientId?, contractDocumentId?, subject? }` → analiza el reclamo contra la biblioteca (RAG) y lo persiste. **201** → `{ claimId, analysis }` con: qué reclama/solicita, contrato aplicable, requerimientos relacionados, entregado/pendiente/fuera de contrato, mejoras adicionales, riesgos.

### `POST /api/claims/:id/respond`
Redacta la respuesta profesional fundada en evidencia. **201** → `{ responseId, content, citations }`.

## Exportación

### `POST /api/export`
`{ format: "pdf|docx|xlsx|pptx|csv", kind: "resumen|comparacion|variables|requerimientos", entityId }` → binario con `Content-Disposition: attachment`.

## RPCs de PostgreSQL (vía supabase-js)

| Función | Uso |
|---|---|
| `hybrid_search(query_text, query_embedding, …filtros)` | Recuperación RAG (RRF) |
| `match_chunks(query_embedding, …)` | Solo vectorial (evidencia de cumplimiento) |
| `search_chunks_text(query_text, …)` | Solo léxica |
| `dashboard_stats()` | KPIs del dashboard en una llamada |
| `can_read_document(doc_id)` | Autorización unificada (usada por RLS y RPCs) |
