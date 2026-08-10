'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { formToObject, persistRecord, softDeleteRecord } from '@/lib/services/persist';
import {
  buildStoragePath, createDownloadUrl, createUploadTicket, removeObject,
  type Bucket, BUCKETS,
} from '@/lib/services/storage';
import { DocumentLinkSchema, DocumentSchema } from '@/lib/validations/documents';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

type FormState = ActionResult<{ id: string }> | null;

/**
 * Gestion documental (FASE 10).
 *
 * El recorrido de una subida es deliberadamente en tres pasos:
 *
 *   1. `requestUploadTicket` — el servidor decide la ruta y firma el
 *      permiso de subida. Aqui es donde se autoriza.
 *   2. El navegador sube el fichero directamente a Storage con ese
 *      ticket. El binario no atraviesa el servidor de Next.
 *   3. `registerDocument` — se guardan los metadatos en PostgreSQL.
 *
 * Es mas trabajo que un `<input type=file>` contra un endpoint propio, y
 * a cambio: no hay limite de payload de Server Action, el servidor no
 * sostiene ficheros de 100 MB en memoria y la autorizacion sigue siendo
 * una policy de Storage, no una comprobacion en TypeScript.
 */

// =====================================================================
// 1) Ticket de subida
// =====================================================================
export async function requestUploadTicket(input: {
  projectCode: string;
  bucket: string;
  fileName: string;
  entityType?: string;
  entityId?: string;
}): Promise<ActionResult<{ bucket: Bucket; path: string; token: string }>> {
  const { project } = await requireProject(input.projectCode);

  if (!can(project, 'documents.upload')) {
    return failure('No tienes permiso para subir documentos en este proyecto.');
  }

  const bucket = input.bucket as Bucket;
  if (!BUCKETS.includes(bucket)) return failure('Bucket no valido.');

  const fileName = String(input.fileName ?? '').trim();
  if (!fileName) return failure('El archivo no tiene nombre.');

  // Sin entidad asociada el documento cuelga de si mismo: la ruta
  // mantiene los cuatro segmentos que exigen las Storage policies.
  const entityType = input.entityType?.trim() || 'DOCUMENT';
  const entityId = input.entityId?.trim() || crypto.randomUUID();

  const path = buildStoragePath({
    projectCode: project.code,
    entityType,
    entityId,
    fileName,
  });

  const ticket = await createUploadTicket(bucket, path);
  if (!ticket.ok) return failure(toUserMessage(ticket.error));

  return success(ticket.ticket);
}

// =====================================================================
// 2) Registro de metadatos
// =====================================================================
export async function registerDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectCode = String(formData.get('projectCode') ?? '');
  const { project, session } = await requireProject(projectCode);

  const raw = formToObject(formData, {
    booleans: ['is_confidential'],
    numbers: ['file_size'],
  });

  const result = await persistRecord({
    projectCode,
    table: 'documents',
    module: 'documents',
    schema: DocumentSchema,
    raw,
    stamp: { createdBy: false, uploadedBy: true },
    revalidate: [`/${projectCode}/documentos`],
    successMessage: 'Documento subido.',
  });

  if (!result.ok) {
    // Los metadatos no entraron: el objeto quedaria huerfano en el bucket.
    const bucket = String(raw.bucket ?? '');
    const path = String(raw.storage_path ?? '');
    if (bucket && path) await removeObject(bucket, path);
    return result;
  }

  const supabase = await createClient();

  // Asociacion a la entidad de origen, si la subida venia de una ficha.
  const entityType = formData.get('entity_type');
  const entityId = formData.get('entity_id');
  if (entityType && entityId) {
    const link = DocumentLinkSchema.safeParse({
      document_id: result.data.id,
      entity_type: String(entityType),
      entity_id: String(entityId),
      relation: formData.get('relation') ? String(formData.get('relation')) : undefined,
    });
    if (link.success) {
      await supabase.from('document_links').insert({
        ...link.data,
        project_id: project.id,
        created_by: session.user?.id ?? null,
      });
    }
  }

  // Los tipos marcados como `requires_approval` no nacen vigentes: nacen
  // pendientes de que alguien los apruebe. Lo dice el catalogo, no el
  // formulario, para que no dependa de que quien sube se acuerde.
  const { data: type } = await supabase
    .from('document_types')
    .select('requires_approval')
    .eq('id', String(raw.document_type_id ?? ''))
    .maybeSingle();

  if (type?.requires_approval) {
    await supabase.from('documents')
      .update({ status: 'EN_REVISION' })
      .eq('id', result.data.id);

    await supabase.from('approvals').insert({
      project_id: project.id,
      entity_type: 'DOCUMENT',
      entity_id: result.data.id,
      requested_by: session.user?.id ?? null,
      status: 'PENDIENTE',
    });
  }

  revalidatePath(`/${projectCode}/documentos`);
  revalidatePath(`/${projectCode}/documentos/${result.data.id}`);
  return result;
}

// =====================================================================
// 3) Nueva version
// =====================================================================
export async function registerDocumentVersion(input: {
  projectCode: string;
  documentId: string;
  bucket: string;
  path: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  comment?: string | null;
}): Promise<ActionResult<{ version: number }>> {
  const { project } = await requireProject(input.projectCode);
  if (!can(project, 'documents.update')) {
    return failure('No tienes permiso para versionar documentos en este proyecto.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_document_version', {
    p_document_id: input.documentId,
    p_bucket: input.bucket,
    p_storage_path: input.path,
    p_mime_type: input.mimeType ?? null,
    p_file_size: input.fileSize ?? null,
    p_file_hash: input.fileHash ?? null,
    p_comment: input.comment ?? null,
  });

  if (error) {
    await removeObject(input.bucket, input.path);
    return failure(toUserMessage(error.message));
  }

  revalidatePath(`/${input.projectCode}/documentos/${input.documentId}`);
  const version = (data as { version?: number } | null)?.version ?? 0;
  return success({ version }, `Version ${version} registrada.`);
}

// =====================================================================
// 4) Descarga
//
// No existe una URL permanente de un documento privado: se firma una de
// dos minutos en el momento en que alguien pulsa descargar, y la firma la
// hace el cliente del usuario, asi que Storage vuelve a comprobar sus
// policies. Un enlace copiado caduca solo.
// =====================================================================
export async function getDocumentDownloadUrl(
  projectCode: string,
  documentId: string,
): Promise<ActionResult<{ url: string; name: string }>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'documents.view')) {
    return failure('No tienes permiso para ver documentos en este proyecto.');
  }

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('name, bucket, storage_path')
    .eq('id', documentId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!doc) return failure('El documento no existe o no tienes acceso a el.');

  const signed = await createDownloadUrl(doc.bucket, doc.storage_path, { download: doc.name });
  if (!signed.ok) return failure(toUserMessage(signed.error));

  return success({ url: signed.url, name: doc.name });
}

/** Descarga de una version concreta del historial. */
export async function getVersionDownloadUrl(
  projectCode: string,
  versionId: string,
): Promise<ActionResult<{ url: string }>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'documents.view')) return failure('No tienes permiso para ver documentos.');

  const supabase = await createClient();
  const { data } = await supabase
    .from('document_versions')
    .select('bucket, storage_path')
    .eq('id', versionId)
    .eq('project_id', project.id)
    .maybeSingle();

  if (!data) return failure('La version no existe o no tienes acceso.');

  const signed = await createDownloadUrl(data.bucket, data.storage_path);
  if (!signed.ok) return failure(toUserMessage(signed.error));
  return success({ url: signed.url });
}

// =====================================================================
// 5) Asociaciones
// =====================================================================
export async function linkDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectCode = String(formData.get('projectCode') ?? '');
  const { project, session } = await requireProject(projectCode);

  if (!can(project, 'documents.update')) {
    return failure('No tienes permiso para asociar documentos en este proyecto.');
  }

  const parsed = DocumentLinkSchema.safeParse(formToObject(formData));
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? 'Datos invalidos');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_links')
    .insert({
      ...parsed.data,
      project_id: project.id,
      created_by: session.user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/documentos/${parsed.data.document_id}`);
  return success({ id: data.id }, 'Documento asociado.');
}

export async function unlinkDocument(
  projectCode: string,
  linkId: string,
  documentId: string,
): Promise<ActionResult<null>> {
  const { project } = await requireProject(projectCode);
  if (!can(project, 'documents.update')) {
    return failure('No tienes permiso para modificar asociaciones.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('document_links')
    .delete()
    .eq('id', linkId)
    .eq('project_id', project.id);

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/documentos/${documentId}`);
  return success(null, 'Asociacion eliminada.');
}

// =====================================================================
// 6) Aprobaciones
// =====================================================================
export async function requestDocumentApproval(
  projectCode: string,
  documentId: string,
): Promise<ActionResult<{ id: string }>> {
  const { project, session } = await requireProject(projectCode);
  if (!can(project, 'documents.update')) {
    return failure('No tienes permiso para solicitar aprobaciones.');
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('approvals')
    .select('id')
    .eq('project_id', project.id)
    .eq('entity_type', 'DOCUMENT')
    .eq('entity_id', documentId)
    .eq('status', 'PENDIENTE')
    .maybeSingle();

  if (existing) return success({ id: existing.id }, 'Ya habia una solicitud pendiente.');

  const { data, error } = await supabase
    .from('approvals')
    .insert({
      project_id: project.id,
      entity_type: 'DOCUMENT',
      entity_id: documentId,
      requested_by: session.user?.id ?? null,
      status: 'PENDIENTE',
    })
    .select('id')
    .single();

  if (error) return failure(toUserMessage(error.message));

  await supabase.from('documents').update({ status: 'EN_REVISION' }).eq('id', documentId);

  revalidatePath(`/${projectCode}/documentos/${documentId}`);
  return success({ id: data.id }, 'Aprobacion solicitada.');
}

/**
 * Resuelve una aprobacion.
 *
 * La decision la toma `public.decide_approval` en PostgreSQL: es quien
 * comprueba el permiso `documents.approve`, que no vuelva a resolverse
 * algo ya resuelto y que el estado del documento acompane a la decision.
 * Repetir esas reglas aqui seria tener dos fuentes de verdad.
 */
export async function decideDocumentApproval(input: {
  projectCode: string;
  approvalId: string;
  approve: boolean;
  comment?: string;
  documentId?: string;
}): Promise<ActionResult<null>> {
  const { projectCode, approvalId, approve, comment, documentId } = input;
  await requireProject(projectCode);

  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_approval', {
    p_approval_id: approvalId,
    p_approve: approve,
    p_comment: comment ?? null,
  });

  if (error) return failure(toUserMessage(error.message));

  revalidatePath(`/${projectCode}/documentos`);
  if (documentId) revalidatePath(`/${projectCode}/documentos/${documentId}`);
  return success(null, approve ? 'Documento aprobado.' : 'Documento rechazado.');
}

// =====================================================================
// 7) Baja
//
// Se marca `deleted_at` y el objeto permanece en el bucket: un documento
// financiero o legal borrado por error no debe ser irrecuperable.
// =====================================================================
export async function deleteDocument(
  projectCode: string,
  id: string,
): Promise<ActionResult<null>> {
  return softDeleteRecord({
    projectCode, table: 'documents', id, module: 'documents',
    revalidate: [`/${projectCode}/documentos`],
  });
}
