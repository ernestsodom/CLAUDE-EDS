import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * Capa de acceso a Supabase Storage (§41, §98).
 *
 * Tres reglas que no se negocian:
 *
 *  1. Los ficheros NUNCA se guardan en PostgreSQL. La base guarda
 *     metadatos: bucket, ruta, tamano, mime y hash.
 *  2. Todos los buckets son PRIVADOS. No existe una URL publica de un
 *     contrato: se firma una URL de vida corta cada vez que hace falta.
 *  3. Se opera con el cliente del usuario (anon key + su sesion), no con
 *     la service role. Asi las Storage policies de `023_storage.sql`
 *     deciden quien sube y quien lee. La service role sigue siendo
 *     innecesaria para esto, y lo que no se usa no se puede filtrar.
 */

export const BUCKETS = [
  'documents', 'photos', 'designs', 'quotes', 'invoices', 'contracts',
] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Segundos de validez de una URL de descarga. Corta a proposito. */
export const DOWNLOAD_TTL_SECONDS = 120;

/**
 * Nombre de fichero seguro para una ruta de Storage.
 *
 * Se conserva el nombre original —que es informacion util cuando alguien
 * mira el bucket— pero sin acentos, espacios ni separadores que puedan
 * romper la ruta o confundir a las policies, que trocean por '/'.
 */
export function sanitizeFileName(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();

  const safe = clean || 'archivo';
  return safe.length > 96 ? safe.slice(-96) : safe;
}

/**
 * Ruta canonica: {PROJECT_CODE}/{entity_type}/{entity_id}/{uuid}_{filename}
 *
 * El primer segmento es el codigo de proyecto porque es de lo que dependen
 * las Storage policies para resolver permisos. Cambiar esta convencion
 * obliga a cambiar `app.storage_project_id`, no solo este fichero.
 */
export function buildStoragePath(input: {
  projectCode: string;
  entityType: string;
  entityId: string;
  fileName: string;
}): string {
  const entity = input.entityType.toLowerCase().replace(/[^a-z_]/g, '') || 'document';
  return [
    input.projectCode.toUpperCase(),
    entity,
    input.entityId,
    `${randomUUID()}_${sanitizeFileName(input.fileName)}`,
  ].join('/');
}

export interface UploadTicket {
  bucket: Bucket;
  path: string;
  token: string;
}

/**
 * Ticket de subida directa navegador -> Storage.
 *
 * El fichero no pasa por el servidor de Next: se firma un permiso de
 * subida para UNA ruta concreta y el navegador sube contra Storage. La
 * autorizacion ocurre aqui, al firmar, bajo el JWT del usuario: si no
 * tiene `documents.upload` en ese proyecto, la policy rechaza y no hay
 * ticket que dar.
 */
export async function createUploadTicket(
  bucket: Bucket,
  path: string,
): Promise<{ ok: true; ticket: UploadTicket } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo preparar la subida.' };
  }
  return { ok: true, ticket: { bucket, path, token: data.token } };
}

/** URL firmada de descarga, de vida corta. */
export async function createDownloadUrl(
  bucket: string,
  path: string,
  options: { expiresIn?: number; download?: string } = {},
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, options.expiresIn ?? DOWNLOAD_TTL_SECONDS,
      options.download ? { download: options.download } : undefined);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'No se pudo generar el enlace de descarga.' };
  }
  return { ok: true, url: data.signedUrl };
}

/**
 * Descarga el contenido de un objeto server-side.
 *
 * Lo usa la extraccion documental con IA: el fichero viaja del bucket al
 * proceso servidor y de ahi al modelo, sin exponer una URL publica ni
 * pasar por el navegador.
 */
export async function downloadObject(
  bucket: string,
  path: string,
): Promise<{ ok: true; bytes: Uint8Array; mimeType: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo leer el archivo.' };
  }
  return {
    ok: true,
    bytes: new Uint8Array(await data.arrayBuffer()),
    mimeType: data.type || 'application/octet-stream',
  };
}

/** Borra el objeto del bucket. Se usa al deshacer una subida a medias. */
export async function removeObject(bucket: string, path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([path]);
}
