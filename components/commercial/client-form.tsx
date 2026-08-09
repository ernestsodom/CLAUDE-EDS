'use client';

import { useActionState } from 'react';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { createClientRecord } from '@/actions/crm';
import { CLIENT_STATUSES, LEAD_SOURCES } from '@/lib/validations/crm';
import type { ActionResult } from '@/actions/types';

export function ClientForm({ projectCode }: { projectCode: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createClientRecord,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectCode" value={projectCode} />

      <div>
        <label htmlFor="company_name" className="label">Nombre de la empresa *</label>
        <input id="company_name" name="company_name" required className="input" placeholder="Club Padel Madrid" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tax_id" className="label">CIF / NIF</label>
          <input id="tax_id" name="tax_id" className="input" placeholder="B81234567" />
        </div>
        <div>
          <label htmlFor="country" className="label">Pais (ISO 2)</label>
          <input id="country" name="country" maxLength={2} className="input uppercase" placeholder="ES" />
        </div>
        <div>
          <label htmlFor="city" className="label">Ciudad</label>
          <input id="city" name="city" className="input" placeholder="Madrid" />
        </div>
        <div>
          <label htmlFor="website" className="label">Sitio web</label>
          <input id="website" name="website" className="input" placeholder="clubpadelmadrid.es" />
        </div>
        <div>
          <label htmlFor="status" className="label">Estado</label>
          <select id="status" name="status" className="input" defaultValue="PROSPECTO">
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="label">Origen</label>
          <select id="source" name="source" className="input" defaultValue="">
            <option value="">Sin especificar</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="address" className="label">Direccion</label>
        <input id="address" name="address" className="input" placeholder="Calle Alcala 234" />
      </div>

      <div>
        <label htmlFor="notes" className="label">Notas</label>
        <textarea id="notes" name="notes" rows={3} className="input resize-none" />
      </div>

      {state && !state.ok ? (
        <div role="alert" className="flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isPending ? 'Guardando...' : 'Crear cliente'}
        </button>
      </div>
    </form>
  );
}
