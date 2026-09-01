# Fase 4 — Almacenamiento de archivos: Supabase Storage → Vercel Blob

## Por qué Vercel Blob

Neon es solo Postgres: no trae un equivalente a Supabase Storage. Había que
elegir un proveedor aparte. Vercel Blob es la opción con menos fricción para
este proyecto — vive en la misma cuenta/plataforma donde ya está desplegado
LicitIA, sin credenciales ni proveedor nuevo que dar de alta, y desde la
versión `2.8` del SDK admite blobs **privados** con descarga controlada por
el servidor (antes solo tenía blobs públicos) — así se conserva el mismo
modelo de acceso que tenía Supabase Storage: nadie puede leer un archivo por
la URL a secas, hace falta pasar por una ruta autenticada de la app.

**No pude crear el Blob Store yo mismo**: las herramientas de Vercel
disponibles no incluyen aprovisionar Storage — es un paso de un clic en el
dashboard del proyecto (`Storage` → `Create Database` → `Blob`) o
`vercel blob store add` con la CLI. Una vez creado, Vercel inyecta
`BLOB_READ_WRITE_TOKEN` solo si el store queda conectado al proyecto; en
local, `vercel env pull` la trae al `.env`.

## Interruptor

Igual patrón que las fases 2 y 3: `BLOB_READ_WRITE_TOKEN` decide. Sin ella,
cero cambio de comportamiento — todo sigue en Supabase Storage exactamente
como hasta ahora. No depende de `DATABASE_URL`/Neon: se puede activar el
almacenamiento en Blob sin haber activado todavía la base o la autenticación
(aunque en la práctica las tres se activarán juntas).

## Qué cambió

- `lib/storage.ts`: capa nueva (`useBlobStorage()`, `uploadBuffer()`,
  `downloadBlob()`, `removeBlobs()`) sobre `@vercel/blob`. Todos los blobs se
  crean `access: "private"` — no hay URL pública, solo el servidor (con el
  token) puede leerlos.
- Subida grande de documentos (`lib/upload-document.ts` +
  `api/documents/upload-init` + `api/documents/blob-upload-token`, nuevo):
  el navegador sigue subiendo el binario DIRECTO al almacenamiento — nunca a
  través de una función de Vercel, que rechaza cuerpos de más de ~4.5 MB —
  pero ahora con `@vercel/blob/client` en vez de `supabase-js`.
  `upload-init` sigue calculando el `storagePath` determinístico *antes* de
  que exista el archivo (igual que con Supabase); `blob-upload-token` solo
  emite el token de subida, autenticado con `requireUser()`.
- Descarga (`api/documents/[id]/file`, `api/notes/attachments/[id]`): con
  Blob, la ruta misma sirve el archivo (`?download=1`) tras verificar el
  permiso; con Supabase, sigue redirigiendo a una URL firmada de una hora.
  El contrato JSON que ya consumía el frontend (`{url, fileName, mimeType}`)
  no cambió — `url` ahora es siempre una ruta propia de la app.
- Subida de adjuntos de comentarios (`api/notes/[id]/attachments`, ya pasaba
  por el servidor — el navegador nunca subía directo aquí) y borrado de
  archivos al eliminar un documento (`api/documents/[id]`): ambos ramifican
  por `useBlobStorage()`.
- Ingesta (`core/services/ingestion.service.ts`): la descarga para
  OCR/extracción y la subida de cada entrada de un ZIP expandido, igual.

## Lo que NO cambió

- El esquema de datos: `storage_path` sigue siendo una columna de texto
  opaca. Con Supabase es una ruta relativa dentro de un bucket; con Blob, el
  `pathname` que devuelve el SDK (sin sufijo aleatorio, para que sea
  predecible) — en ambos casos, solo `lib/storage.ts` y los repositorios de
  Supabase Storage lo interpretan.
- El modelo de autorización: quien pide un archivo sigue pasando primero por
  `requireUser()` (RLS o, en Blob, el mismo chequeo de sesión) antes de que
  el servidor entregue una URL firmada o los bytes.

## Pendiente para activar en producción

1. Crear el Blob Store en el proyecto de Vercel (un clic) y confirmar que
   `BLOB_READ_WRITE_TOKEN` quedó disponible en el entorno de producción.
2. Migrar los 34 archivos existentes de los buckets `documents` y
   `attachments` de Supabase a Blob (descargarlos con `supabase.storage
   .download()` y subirlos con `put()`, conservando el mismo `storage_path`
   para no tener que tocar las filas de `files`/`note_attachments`) — no se
   hizo en esta pasada porque requiere el store ya creado.
3. Probar de punta a punta en un preview: subir un documento grande (>4.5
   MB), abrirlo, adjuntar un archivo a un comentario, abrirlo, eliminar un
   documento y confirmar que el blob se borra.
