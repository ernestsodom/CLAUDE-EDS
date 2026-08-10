'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, Loader2, Unlink, X } from 'lucide-react';
import {
  decideDocumentApproval, getDocumentDownloadUrl, getVersionDownloadUrl,
  requestDocumentApproval, unlinkDocument,
} from '@/actions/documents';

/**
 * Acciones de la ficha documental.
 *
 * Todas ellas llaman a una Server Action: el navegador no habla con
 * Storage ni con la base para decidir nada. La descarga abre una URL
 * firmada que caduca en dos minutos, asi que el enlace no sobrevive a un
 * copiar y pegar.
 */

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'No se pudo completar la operacion.');
      else startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return { run, working: busy || pending, error };
}

export function DownloadDocumentButton({
  projectCode, documentId, label = 'Descargar', versionId,
}: {
  projectCode: string;
  documentId?: string;
  versionId?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const result = versionId
        ? await getVersionDownloadUrl(projectCode, versionId)
        : await getDocumentDownloadUrl(projectCode, documentId!);

      if (!result.ok) { setError(result.error); return; }
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={handleClick} disabled={busy} className="btn-secondary">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {label}
      </button>
      {error ? <span className="text-2xs text-critical">{error}</span> : null}
    </span>
  );
}

export function ApprovalDecision({
  projectCode, approvalId, documentId,
}: {
  projectCode: string;
  approvalId: string;
  documentId: string;
}) {
  const { run, working, error } = useAction();
  const [comment, setComment] = useState('');

  return (
    <div className="space-y-2">
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario de la decision (opcional)"
        className="input"
      />
      <div className="flex gap-2">
        <button
          type="button" disabled={working} className="btn-primary"
          onClick={() => run(() => decideDocumentApproval({
            projectCode, approvalId, approve: true, comment, documentId,
          }))}
        >
          {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprobar
        </button>
        <button
          type="button" disabled={working} className="btn-secondary"
          onClick={() => run(() => decideDocumentApproval({
            projectCode, approvalId, approve: false, comment, documentId,
          }))}
        >
          <X size={14} /> Rechazar
        </button>
      </div>
      {error ? <p className="text-2xs text-critical">{error}</p> : null}
    </div>
  );
}

export function RequestApprovalButton({
  projectCode, documentId,
}: { projectCode: string; documentId: string }) {
  const { run, working, error } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button" disabled={working} className="btn-secondary"
        onClick={() => run(() => requestDocumentApproval(projectCode, documentId))}
      >
        {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Solicitar aprobacion
      </button>
      {error ? <span className="text-2xs text-critical">{error}</span> : null}
    </span>
  );
}

export function UnlinkButton({
  projectCode, linkId, documentId,
}: { projectCode: string; linkId: string; documentId: string }) {
  const { run, working } = useAction();
  return (
    <button
      type="button" disabled={working}
      title="Quitar asociacion"
      className="text-content-muted transition hover:text-critical"
      onClick={() => run(() => unlinkDocument(projectCode, linkId, documentId))}
    >
      {working ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
    </button>
  );
}
