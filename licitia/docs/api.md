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

### `POST /api/internal/process` *(interno)*
Body: `{ documentId, versionId, organizationId, userId }`. Ejecuta el pipeline completo con service_role. maxDuration 300 s.

## Chat RAG

### `POST /api/chat` *(SSE)*
```json
{
  "conversationId": "uuid?",       // omitir para crear
  "documentId": "uuid|null",       // null = biblioteca completa
  "agent": "analista|comparador|reclamos|propuestas|comercial",
  "question": "¿Qué multas contempla?",
  "filters": { "docType": "licitacion?", "clientId": "uuid?" }
}
```
Eventos SSE:
- `meta` → `{ conversationId }`
- `delta` → `{ text }` (streaming del texto visible)
- `done` → `{ citations: [{chunk_id, cita_textual, pagina, seccion}], confidence }`
- `error` → `{ message }`

Los mensajes (con citas y confianza) quedan persistidos en `messages`.

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
