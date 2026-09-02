import { put, del, get } from "@vercel/blob";

/**
 * Fase 4 de la migración: almacenamiento de archivos.
 *
 * Igual patrón que las fases 2 y 3: un interruptor decide si los archivos
 * van a Supabase Storage (como siempre) o a Vercel Blob. Sin la variable,
 * cero cambio de comportamiento.
 *
 * `BLOB_READ_WRITE_TOKEN` es imprescindible: la generación del token de
 * subida para el navegador (`handleUpload()`, en
 * `blob-upload-token/route.ts`) no soporta OIDC — siempre firma con ese
 * token. `BLOB_STORE_ID` solo hace falta si además se quiere autenticar por
 * OIDC en vez de por token explícito.
 *
 * Los blobs se crean con `access: "private"`: no son accesibles por URL
 * pública. Para servir un archivo hay que descargarlo aquí, del lado del
 * servidor, autenticado — la misma garantía que daba una política de
 * Storage de Supabase, pero verificada en cada petición en vez de con una
 * URL firmada que vive una hora.
 */

export function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Token explícito para `put`/`get`/`del`, en vez de dejar que `@vercel/blob`
 * lo resuelva solo.
 *
 * Cuando `BLOB_STORE_ID` Y `BLOB_READ_WRITE_TOKEN` están las dos puestas (el
 * caso de este proyecto), la resolución automática de la librería NO es
 * consistente entre operaciones: prueba primero OIDC + `BLOB_STORE_ID`, y
 * solo si eso falla cae a `BLOB_READ_WRITE_TOKEN`. El token de subida que
 * emite `handleUpload()` (`blob-upload-token/route.ts`), en cambio, SIEMPRE
 * sale de `BLOB_READ_WRITE_TOKEN` — esa función no soporta OIDC. Si
 * `BLOB_STORE_ID` apuntara a un store distinto del que codifica
 * `BLOB_READ_WRITE_TOKEN`, la subida iría a un store y la descarga
 * buscaría en otro: "Archivo no encontrado en Blob Storage" siempre, para
 * cualquier archivo, sin relación con si la subida salió bien — exactamente
 * lo que se vio en producción. Fijar aquí el mismo token que usa
 * `handleUpload()` garantiza que las tres operaciones (`put`/`get`/`del`)
 * miren siempre al store correcto.
 */
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

/** Sube un buffer (adjuntos de comentarios, reprocesamiento) y devuelve su pathname. */
export async function uploadBuffer(
  pathname: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(pathname, data, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken(),
  });
  return blob.pathname;
}

/**
 * Descarga el contenido de un blob privado del lado del servidor, para
 * servirlo (rutas de descarga) o procesarlo (ingesta: OCR, extracción).
 */
export async function downloadBlob(pathname: string): Promise<Buffer> {
  const result = await get(pathname, { access: "private", token: blobToken() });
  if (!result) throw new Error(`Archivo no encontrado en Blob Storage: ${pathname}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Borra uno o más archivos. Tolera rutas vacías (nada que borrar). */
export async function removeBlobs(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0) return;
  await del(pathnames, { token: blobToken() });
}
