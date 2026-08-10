'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { requestUploadTicket } from '@/actions/documents';
import {
  discardStatementFile, importBankStatement, previewBankStatement,
  type ImportOutcome, type StatementPreview,
} from '@/actions/bank';
import { Card } from '@/components/ui';
import { formatMoney } from '@/lib/format';

export interface AccountOption { value: string; label: string }

/**
 * Importacion de extractos bancarios (FASE 9b).
 *
 * Nadie importa a ciegas: el fichero se sube, el servidor lo lee y
 * devuelve lo que ha entendido —columnas reconocidas, primeras filas,
 * lineas que no puede interpretar— y solo entonces aparece el boton de
 * importar. Un extracto mal mapeado ensucia la contabilidad durante
 * meses; una pantalla de confirmacion cuesta diez segundos.
 */
export function StatementImporter({
  projectCode, accounts,
}: { projectCode: string; accounts: AccountOption[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [accountId, setAccountId] = useState(accounts[0]?.value ?? '');
  const [decimal, setDecimal] = useState<'COMMA' | 'DOT'>('COMMA');
  const [dateOrder, setDateOrder] = useState<'DMY' | 'MDY' | 'YMD'>('DMY');
  const [invertSign, setInvertSign] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ bucket: string; path: string; fileName: string } | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  function reset() {
    setUploaded(null); setPreview(null); setOutcome(null); setMapping({}); setError(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!accountId) { setError('Elige primero la cuenta bancaria.'); return; }

    setBusy(true); setError(null); setOutcome(null);
    try {
      const ticket = await requestUploadTicket({
        projectCode, bucket: 'documents', fileName: file.name,
        entityType: 'BANK_ACCOUNT', entityId: accountId,
      });
      if (!ticket.ok) { setError(ticket.error); return; }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.data.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || 'text/csv',
        });

      if (uploadError) {
        setError('No se pudo subir el extracto. Comprueba que sea CSV o XLSX.');
        return;
      }

      const target = { bucket: ticket.data.bucket, path: ticket.data.path, fileName: file.name };
      setUploaded(target);

      const result = await previewBankStatement({
        projectCode, ...target, decimal, dateOrder, invertSign,
      });
      if (!result.ok) { setError(result.error); return; }

      setPreview(result.data);
      setMapping(
        Object.fromEntries(
          Object.entries(result.data.mapping).filter(([, v]) => Boolean(v)) as [string, string][],
        ),
      );
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  /** Reinterpreta el fichero ya subido con el mapeo o las opciones corregidas. */
  async function refreshPreview(next: Record<string, string> = mapping) {
    if (!uploaded) return;
    setBusy(true); setError(null);
    try {
      const result = await previewBankStatement({
        projectCode, ...uploaded, mapping: next, decimal, dateOrder, invertSign,
      });
      if (!result.ok) { setError(result.error); return; }
      setPreview(result.data);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!uploaded || !preview) return;
    setBusy(true); setError(null);
    try {
      const result = await importBankStatement({
        projectCode,
        bankAccountId: accountId,
        ...uploaded,
        mapping: mapping as never,
        decimal, dateOrder, invertSign,
      });
      if (!result.ok) { setError(result.error); return; }

      setOutcome(result.data);
      setPreview(null);
      setUploaded(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (uploaded) await discardStatementFile(projectCode, uploaded.bucket, uploaded.path);
    reset();
  }

  const mappingFields: { key: string; label: string; hint?: string }[] = [
    { key: 'date', label: 'Fecha' },
    { key: 'amount', label: 'Importe' },
    { key: 'credit', label: 'Haber', hint: 'si el banco separa debe y haber' },
    { key: 'debit', label: 'Debe' },
    { key: 'description', label: 'Concepto' },
    { key: 'counterparty', label: 'Contrapartida' },
    { key: 'reference', label: 'Referencia' },
    { key: 'value_date', label: 'Fecha valor' },
    { key: 'balance_after', label: 'Saldo' },
  ];

  return (
    <Card className="p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-content-muted">
        Importar extracto
      </h2>
      <p className="mb-4 mt-1 text-2xs text-content-muted">
        CSV o XLSX. La importacion es idempotente: reimportar el mismo extracto no
        duplica movimientos.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="imp-account">Cuenta</label>
          <select id="imp-account" className="input cursor-pointer" value={accountId}
            onChange={(e) => setAccountId(e.target.value)} disabled={Boolean(uploaded)}>
            {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="imp-decimal">Decimales</label>
          <select id="imp-decimal" className="input cursor-pointer" value={decimal}
            onChange={(e) => { setDecimal(e.target.value as 'COMMA' | 'DOT'); }}>
            <option value="COMMA">1.234,56 (coma decimal)</option>
            <option value="DOT">1,234.56 (punto decimal)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="imp-date">Formato de fecha</label>
          <select id="imp-date" className="input cursor-pointer" value={dateOrder}
            onChange={(e) => { setDateOrder(e.target.value as 'DMY' | 'MDY' | 'YMD'); }}>
            <option value="DMY">DD/MM/AAAA</option>
            <option value="MDY">MM/DD/AAAA</option>
            <option value="YMD">AAAA/MM/DD</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-2 text-sm text-content-secondary">
            <input type="checkbox" checked={invertSign}
              onChange={(e) => setInvertSign(e.target.checked)}
              className="h-4 w-4 accent-[rgb(255,90,0)]" />
            Invertir signo
          </label>
        </div>
      </div>

      {!uploaded ? (
        <div className="mt-4">
          <label className="label" htmlFor="imp-file">Archivo del banco</label>
          <input id="imp-file" type="file" accept=".csv,.xlsx,.xlsm,text/csv" onChange={handleFile}
            disabled={busy || accounts.length === 0}
            className="block w-full cursor-pointer rounded border border-line bg-surface-2 px-3 py-2 text-sm text-content-secondary file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:opacity-90" />
        </div>
      ) : null}

      {busy ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-content-muted">
          <Loader2 size={14} className="animate-spin" /> Procesando el archivo...
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      ) : null}

      {/* ------------------------------------------------------------- */}
      {preview ? (
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet size={15} className="text-accent" />
            <span className="font-medium">{uploaded?.fileName}</span>
            <span className="text-content-muted">
              · {preview.rowCount} filas · {preview.detected} movimientos legibles
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {mappingFields.map((field) => (
              <div key={field.key}>
                <label className="label" htmlFor={`map-${field.key}`}>{field.label}</label>
                <select
                  id={`map-${field.key}`} className="input cursor-pointer"
                  value={mapping[field.key] ?? ''}
                  onChange={(e) => {
                    const next = { ...mapping, [field.key]: e.target.value };
                    if (!e.target.value) delete next[field.key];
                    setMapping(next);
                    void refreshPreview(next);
                  }}
                >
                  <option value="">— sin usar —</option>
                  {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {preview.sample.length > 0 ? (
            <div className="overflow-x-auto rounded border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-2xs uppercase tracking-wide text-content-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-left">Referencia</th>
                    <th className="px-3 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.sample.map((t, i) => (
                    <tr key={i}>
                      <td className="tabular px-3 py-1.5">{t.transaction_date}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-content-secondary">{t.description ?? '—'}</td>
                      <td className="px-3 py-1.5 text-2xs text-content-muted">{t.reference ?? '—'}</td>
                      <td className={`tabular px-3 py-1.5 text-right ${t.amount < 0 ? 'text-critical' : 'text-success'}`}>
                        {formatMoney(t.amount, 'EUR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview.issues.length > 0 ? (
            <div className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <p className="font-medium">{preview.issues.length} filas no se van a importar:</p>
              <ul className="mt-1 space-y-0.5 text-2xs">
                {preview.issues.slice(0, 6).map((issue, i) => (
                  <li key={i}>Fila {issue.row}: {issue.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={handleCancel} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleImport}
              disabled={busy || preview.detected === 0}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Importar {preview.detected} movimientos
            </button>
          </div>
        </div>
      ) : null}

      {outcome ? (
        <div className="mt-4 flex items-start gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>
            {outcome.inserted} movimientos importados
            {outcome.duplicates > 0 ? `, ${outcome.duplicates} ya estaban y se han ignorado` : ''}
            {outcome.failed > 0 ? `, ${outcome.failed} filas ilegibles` : ''}.
          </span>
        </div>
      ) : null}
    </Card>
  );
}
