'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { reviewExtraction, runDocumentExtraction } from '@/actions/ai';
import { Card, SectionTitle } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatPercent, humanize } from '@/lib/format';

export interface ExtractionRow {
  id: string;
  extraction_type: string;
  provider: string;
  model: string;
  status: string;
  confidence: number | null;
  structured_data: Record<string, unknown> | null;
  error_message: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string;
  needs_review: boolean;
  ready_to_apply: boolean;
}

/**
 * Extraccion documental con IA (FASE 14, §42).
 *
 * La pantalla deja explicito lo que la base ya impone: lo que produce el
 * modelo es una propuesta. Hasta que alguien con permiso la aprueba, no
 * hay forma —ni por aqui ni por la API— de que esos datos entren en la
 * contabilidad.
 */
export function ExtractionPanel({
  projectCode, documentId, extractionType, extractions,
  canExtract, canReview, canApply,
}: {
  projectCode: string;
  documentId: string;
  extractionType: string;
  extractions: ExtractionRow[];
  canExtract: boolean;
  canReview: boolean;
  canApply: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  async function extract() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await runDocumentExtraction(projectCode, documentId);
      if (!result.ok) { setError(result.error); return; }
      setMessage(result.message ?? 'Extraccion lista.');
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function review(extractionId: string, approve: boolean) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await reviewExtraction({
        projectCode, extractionId, approve, comment, documentId,
      });
      if (!result.ok) { setError(result.error); return; }
      setComment('');
      setMessage(result.message ?? null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const latest = extractions[0];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          title="Lectura automatica"
          subtitle={`Documento de tipo ${extractionType}. La IA propone; una persona decide.`}
        />
        {canExtract ? (
          <button type="button" className="btn-secondary" onClick={extract} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {extractions.length > 0 ? 'Volver a extraer' : 'Extraer datos'}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}

      {extractions.length === 0 ? (
        <p className="mt-3 text-sm text-content-muted">
          Todavia no se ha extraido nada de este documento. Lo que se extraiga quedara
          pendiente de revision: no se escribe en el negocio por su cuenta.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-2xs text-content-muted">
            <StatusBadge status={latest.status} />
            <span>{latest.model}</span>
            <span>· {formatDate(latest.created_at)}</span>
            {latest.confidence !== null ? (
              <span>· campos obligatorios cubiertos {formatPercent(latest.confidence * 100)}</span>
            ) : null}
            {latest.applied_at ? <span>· aplicada el {formatDate(latest.applied_at)}</span> : null}
          </div>

          {latest.error_message && latest.status === 'ERROR' ? (
            <p className="text-sm text-critical">{latest.error_message}</p>
          ) : null}

          {latest.structured_data ? (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {Object.entries(latest.structured_data).map(([key, value]) => (
                <div key={key} className="min-w-0 border-b border-line pb-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-content-muted">
                    {humanize(key)}
                  </dt>
                  <dd className="truncate text-sm">
                    {value === null || value === undefined || value === ''
                      ? <span className="text-content-muted">sin dato en el documento</span>
                      : typeof value === 'object'
                        ? <span className="text-content-secondary">{JSON.stringify(value)}</span>
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {latest.needs_review ? (
            canReview ? (
              <div className="space-y-2 rounded border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm text-warning">
                  Pendiente de revision. Comprueba los datos contra el documento antes de aprobar.
                </p>
                <input
                  value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Comentario de la revision (opcional)" className="input"
                />
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" disabled={busy}
                    onClick={() => review(latest.id, true)}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Aprobar
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy}
                    onClick={() => review(latest.id, false)}>
                    <X size={14} /> Rechazar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-content-muted">
                Pendiente de que alguien con permiso de aprobacion la revise.
              </p>
            )
          ) : null}

          {latest.ready_to_apply && canApply ? (
            <p className="text-sm text-content-secondary">
              Aprobada y lista para aplicar.{' '}
              <Link href={`/${projectCode}/ia`} className="text-accent hover:underline">
                Crear la factura desde la cola de revision
              </Link>.
            </p>
          ) : null}

          {extractions.length > 1 ? (
            <p className="text-2xs text-content-muted">
              {extractions.length - 1} extraccion{extractions.length === 2 ? '' : 'es'} anterior
              {extractions.length === 2 ? '' : 'es'} en el historial.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
