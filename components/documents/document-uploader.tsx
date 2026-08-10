'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  registerDocument, registerDocumentVersion, requestUploadTicket,
} from '@/actions/documents';
import { Card } from '@/components/ui';

export interface DocumentTypeOption {
  id: string;
  code: string;
  name: string;
  category: string;
  bucket: string;
  requires_approval: boolean;
}

/**
 * Subida de documentos a Supabase Storage (FASE 10).
 *
 * El fichero viaja del navegador a Storage directamente, con un ticket
 * firmado que el servidor emite para una ruta concreta. Ni el binario ni
 * ninguna clave privilegiada pasan por el servidor de Next: la unica
 * llave que existe en el navegador es la anon key, y quien decide si la
 * subida es legitima es la Storage policy bajo el JWT del usuario.
 *
 * El hash SHA-256 se calcula aqui, sobre el fichero original, antes de
 * subirlo. Sirve para detectar duplicados y para poder demostrar mas
 * tarde que el archivo del bucket es el que se subio.
 */
export function DocumentUploader({
  projectCode,
  documentTypes,
  entityType,
  entityId,
  mode = 'new',
  documentId,
  compact = false,
}: {
  projectCode: string;
  documentTypes: DocumentTypeOption[];
  entityType?: string;
  entityId?: string;
  /** 'new' crea un documento; 'version' anade una version a `documentId`. */
  mode?: 'new' | 'version';
  documentId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const defaultType = documentTypes[0];
  const [typeId, setTypeId] = useState(defaultType?.id ?? '');
  const selectedType = documentTypes.find((t) => t.id === typeId) ?? defaultType;

  async function sha256(file: File): Promise<string | null> {
    if (!globalThis.crypto?.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');

    if (!(file instanceof File) || file.size === 0) {
      setError('Elige un archivo.');
      return;
    }
    const bucket = mode === 'version'
      ? String(data.get('bucket') ?? 'documents')
      : (selectedType?.bucket ?? 'documents');

    setBusy(true);
    try {
      // 1) El servidor autoriza y firma la subida para una ruta concreta.
      const ticket = await requestUploadTicket({
        projectCode,
        bucket,
        fileName: file.name,
        entityType,
        entityId,
      });
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }

      // 2) El navegador sube contra Storage.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.data.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) {
        setError(
          uploadError.message.toLowerCase().includes('mime')
            ? 'Ese tipo de archivo no esta permitido en este bucket.'
            : 'No se pudo subir el archivo. Revisa el tamano y el formato.',
        );
        return;
      }

      const hash = await sha256(file);

      // 3) Metadatos en PostgreSQL.
      if (mode === 'version' && documentId) {
        const result = await registerDocumentVersion({
          projectCode,
          documentId,
          bucket: ticket.data.bucket,
          path: ticket.data.path,
          mimeType: file.type || null,
          fileSize: file.size,
          fileHash: hash,
          comment: (data.get('comment') as string) || null,
        });
        if (!result.ok) { setError(result.error); return; }
        setMessage(result.message ?? 'Version registrada.');
      } else {
        const payload = new FormData();
        payload.set('projectCode', projectCode);
        payload.set('document_type_id', String(data.get('document_type_id') ?? ''));
        payload.set('name', String(data.get('name') || file.name));
        if (data.get('description')) payload.set('description', String(data.get('description')));
        payload.set('bucket', ticket.data.bucket);
        payload.set('storage_path', ticket.data.path);
        payload.set('mime_type', file.type || 'application/octet-stream');
        payload.set('file_size', String(file.size));
        if (hash) payload.set('file_hash', hash);
        if (data.get('is_confidential')) payload.set('is_confidential', 'true');
        if (entityType && entityId) {
          payload.set('entity_type', entityType);
          payload.set('entity_id', entityId);
        }

        const result = await registerDocument(null, payload);
        if (!result || !result.ok) {
          setError(result?.error ?? 'No se pudo registrar el documento.');
          return;
        }
        setMessage(
          selectedType?.requires_approval
            ? 'Documento subido. Queda en revision: este tipo requiere aprobacion.'
            : (result.message ?? 'Documento subido.'),
        );
      }

      form.reset();
      setFileName(null);
      startTransition(() => router.refresh());
    } catch {
      setError('No se pudo completar la subida. Intentalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  const body = (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {mode === 'new' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc-type">Tipo de documento <span className="text-accent">*</span></label>
            <select
              id="doc-type" name="document_type_id" required value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="input cursor-pointer"
            >
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.category} · {t.name}</option>
              ))}
            </select>
            {selectedType ? (
              <p className="mt-1 text-2xs text-content-muted">
                Bucket <span className="text-content-secondary">{selectedType.bucket}</span>
                {selectedType.requires_approval ? ' · requiere aprobacion' : null}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="doc-name">Nombre</label>
            <input id="doc-name" name="name" className="input" placeholder="Se usa el nombre del archivo si lo dejas vacio" />
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="doc-comment">Que cambia en esta version</label>
          <input id="doc-comment" name="comment" className="input" placeholder="Ej. firmado por el cliente" />
        </div>
      )}

      <div>
        <label className="label" htmlFor="doc-file">Archivo <span className="text-accent">*</span></label>
        <input
          id="doc-file" name="file" type="file" required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full cursor-pointer rounded border border-line bg-surface-2 px-3 py-2 text-sm text-content-secondary file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:opacity-90"
        />
        {fileName ? <p className="mt-1 text-2xs text-content-muted">{fileName}</p> : null}
      </div>

      {mode === 'new' && !compact ? (
        <>
          <div>
            <label className="label" htmlFor="doc-desc">Descripcion</label>
            <input id="doc-desc" name="description" className="input" />
          </div>
          <label className="flex items-start gap-2.5 py-1 text-sm text-content-secondary">
            <input type="checkbox" name="is_confidential" value="true"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(255,90,0)]" />
            <span>
              Confidencial
              <span className="block text-2xs text-content-muted">
                Solo lo veran quien lo sube y quien administra el proyecto.
              </span>
            </span>
          </label>
        </>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-start gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" /><span>{message}</span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={working} className="btn-primary">
          {working ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {working ? 'Subiendo...' : mode === 'version' ? 'Subir nueva version' : 'Subir documento'}
        </button>
      </div>
    </form>
  );

  if (compact) return body;

  return (
    <Card className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-content-muted">
        {mode === 'version' ? 'Nueva version' : 'Subir documento'}
      </h2>
      <p className="mb-4 mt-1 text-2xs text-content-muted">
        El archivo va directo a Supabase Storage con una URL firmada. Los buckets son
        privados: cada descarga genera un enlace temporal.
      </p>
      {body}
    </Card>
  );
}
