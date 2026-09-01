import { put, del, get } from "@vercel/blob";

/**
 * Fase 4 de la migración: almacenamiento de archivos.
 *
 * Igual patrón que las fases 2 y 3: un interruptor (`BLOB_READ_WRITE_TOKEN`)
 * decide si los archivos van a Supabase Storage (como siempre) o a Vercel
 * Blob. Sin la variable, cero cambio de comportamiento.
 *
 * Los blobs se crean con `access: "private"`: no son accesibles por URL
 * pública. Para servir un archivo hay que descargarlo aquí, del lado del
 * servidor, con el token de la app — la misma garantía que daba una
 * política de Storage de Supabase, pero verificada en cada petición en vez
 * de con una URL firmada que vive una hora.
 */

export function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  });
  return blob.pathname;
}

/**
 * Descarga el contenido de un blob privado del lado del servidor, para
 * servirlo (rutas de descarga) o procesarlo (ingesta: OCR, extracción).
 */
export async function downloadBlob(pathname: string): Promise<Buffer> {
  const result = await get(pathname, { access: "private" });
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
  await del(pathnames);
}
