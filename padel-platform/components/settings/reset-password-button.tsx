'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, X } from 'lucide-react';
import { resetUserPassword } from '@/actions/users';

/**
 * Restablecer contrasena de otro usuario (§96).
 *
 * Accion sensible: se pide la contrasena nueva dentro de un dialogo, nunca
 * en linea, y el resultado se confirma antes de cerrarse.
 */
export function ResetPasswordButton({
  projectCode,
  userId,
}: {
  projectCode: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await resetUserPassword(projectCode, userId, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? 'Contrasena actualizada.');
      setPassword('');
      setTimeout(() => {
        setOpen(false);
        setDone(null);
      }, 1400);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary px-2 py-1 text-2xs"
        title="Restablecer contrasena"
      >
        <KeyRound size={13} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !isPending && setOpen(false)} />

          <div className="relative w-full max-w-sm rounded-lg border border-line-strong bg-surface p-5 shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => !isPending && setOpen(false)}
              className="btn-ghost absolute right-2 top-2 px-2 py-1"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            <h2 className="text-base font-semibold">Restablecer contrasena</h2>
            <p className="mt-1 text-sm text-content-secondary">
              El usuario podra iniciar sesion con esta contrasena de inmediato.
            </p>

            <div className="mt-4">
              <label htmlFor="new-password" className="label">
                Contrasena nueva
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Minimo 8 caracteres"
              />
            </div>

            {error ? (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {done ? (
              <div className="mt-4 flex items-start gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                <span>{done}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || password.length < 8 || Boolean(done)}
                className="btn-primary"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                {isPending ? 'Guardando...' : 'Restablecer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
