import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { DocumentTypeOption } from '@/components/documents/document-uploader';

/**
 * Catalogo de tipos documentales.
 *
 * El tipo decide el bucket, si hace falta aprobacion, si el documento es
 * versionable y si admite extraccion con IA. Es configuracion en base de
 * datos, no un `switch` en el codigo: anadir "Certificado de origen" es un
 * INSERT, no un despliegue.
 */
export async function getDocumentTypeOptions(): Promise<DocumentTypeOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('document_types')
    .select('id, code, name, category, bucket, requires_approval')
    .eq('active', true)
    .order('sort_order')
    .order('name');

  return (data ?? []) as DocumentTypeOption[];
}

export interface DocumentDetail {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  file_hash: string | null;
  current_version: number;
  status: string;
  is_confidential: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  document_types: {
    id: string; code: string; name: string; category: string;
    requires_approval: boolean; is_versioned: boolean; ai_extraction_type: string | null;
  } | null;
  profiles: { full_name: string | null } | null;
}

export async function getDocument(
  id: string,
  projectId: string,
): Promise<DocumentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('documents')
    .select(
      'id, project_id, name, description, bucket, storage_path, mime_type, file_size, file_hash,' +
      ' current_version, status, is_confidential, valid_from, valid_until, created_at,' +
      ' document_types(id, code, name, category, requires_approval, is_versioned, ai_extraction_type),' +
      ' profiles!documents_uploaded_by_fkey(full_name)',
    )
    .eq('id', id)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  return (data as DocumentDetail | null) ?? null;
}
