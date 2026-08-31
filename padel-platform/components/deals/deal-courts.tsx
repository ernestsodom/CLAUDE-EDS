'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { deleteDealCourt, saveDealCourt, toggleCourtLogo } from '@/actions/deals';
import { formatMoney } from '@/lib/format';
import { Card, SectionTitle } from '@/components/ui';
import { LOGO_BRANDS, LOGO_BRAND_LABEL } from '@/lib/validations/deals';
import type {
  CourtModel, DealCourt, DealCourtLogo, LogoBrand, LogoPosition,
} from '@/types/database.types';

/**
 * Canchas del negocio.
 *
 * Cada cancha es una fila propia (y no una cantidad) porque cada una
 * puede llevar su propia personalizacion: es justo el dato que el trader
 * tiene que trasladar a la fabrica. Los logos se marcan en una rejilla
 * marca x posicion, que se lee de un vistazo y evita el error clasico de
 * describir la personalizacion en texto libre.
 */
export function DealCourts({
  projectCode,
  dealId,
  courts,
  models,
  positions,
  logos,
  defaultCommission,
  editable,
  deletable,
  total,
}: {
  projectCode: string;
  dealId: string;
  courts: DealCourt[];
  models: CourtModel[];
  positions: LogoPosition[];
  logos: DealCourtLogo[];
  defaultCommission: number;
  editable: boolean;
  deletable: boolean;
  total: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const modelName = (id: string) => models.find((m) => m.id === id)?.name ?? '—';
  const activeModels = models.filter((m) => m.active || courts.some((c) => c.court_model_id === m.id));

  function submit(formData: FormData, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await saveDealCourt(null, formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function remove(courtId: string) {
    if (!window.confirm('¿Eliminar esta cancha del negocio?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDealCourt(projectCode, courtId, dealId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function toggleLogo(courtId: string, brand: LogoBrand, positionId: string, enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleCourtLogo({
        projectCode, dealId, courtId, brand, logoPositionId: positionId, enabled,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const courtForm = (court: DealCourt | null) => (
    <form
      action={(formData) => submit(formData, () => (court ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      <input type="hidden" name="deal_id" value={dealId} />
      {court ? <input type="hidden" name="id" value={court.id} /> : null}

      <div className="col-span-12 sm:col-span-4">
        <label className="label">Tipo de cancha</label>
        <select
          name="court_model_id"
          defaultValue={court?.court_model_id ?? activeModels[0]?.id ?? ''}
          className="input"
          required
        >
          {activeModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="col-span-4 sm:col-span-2">
        <label className="label">Nº</label>
        <input
          type="number"
          name="position"
          min={1}
          defaultValue={court?.position ?? courts.length + 1}
          className="input tabular"
        />
      </div>

      <div className="col-span-8 sm:col-span-3">
        <label className="label">Comision (USD)</label>
        <input
          type="number"
          name="commission_usd"
          step="0.01"
          min={0}
          defaultValue={court?.commission_usd ?? defaultCommission}
          className="input tabular"
          required
        />
      </div>

      <div className="col-span-12 sm:col-span-3 flex items-center gap-2 pb-2">
        <input
          id={`custom-${court?.id ?? 'new'}`}
          type="checkbox"
          name="is_custom"
          value="true"
          defaultChecked={court?.is_custom ?? false}
          className="h-4 w-4 accent-[rgb(255,90,0)]"
        />
        <label htmlFor={`custom-${court?.id ?? 'new'}`} className="text-sm text-content-secondary">
          Personalizada
        </label>
      </div>

      <div className="col-span-12">
        <label className="label">Especificaciones</label>
        <input
          type="text"
          name="specs"
          defaultValue={court?.specs ?? ''}
          placeholder="Color de estructura, cesped, iluminacion..."
          className="input"
        />
      </div>

      <div className="col-span-12 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (court ? setEditingId(null) : setAdding(false))}
          className="btn-secondary"
        >
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          {court ? 'Guardar' : 'Anadir cancha'}
        </button>
      </div>
    </form>
  );

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-4 pt-4">
        <SectionTitle>Canchas ({courts.length})</SectionTitle>
        <span className="text-sm">
          <span className="text-2xs text-content-muted">Comision total </span>
          <span className="tabular font-medium">{formatMoney(total, 'USD')}</span>
        </span>
      </div>

      {error ? (
        <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-line border-t border-line">
        {courts.map((court) =>
          editingId === court.id ? (
            <li key={court.id}>{courtForm(court)}</li>
          ) : (
            <li key={court.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-medium">
                    #{court.position} · {modelName(court.court_model_id)}
                  </span>
                  {court.is_custom ? (
                    <span className="ml-2 badge border border-accent/30 bg-accent/15 text-accent">
                      Personalizada
                    </span>
                  ) : null}
                  {court.specs ? (
                    <span className="block text-2xs text-content-muted">{court.specs}</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span className="tabular text-sm">{formatMoney(court.commission_usd, 'USD')}</span>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(court.id)}
                      className="btn-secondary px-2 py-1"
                      title="Editar cancha"
                    >
                      <Pencil size={13} />
                    </button>
                  ) : null}
                  {deletable ? (
                    <button
                      type="button"
                      onClick={() => remove(court.id)}
                      disabled={isPending}
                      className="btn-secondary px-2 py-1"
                      title="Eliminar cancha"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Rejilla de logos: solo tiene sentido si la cancha es
                  personalizada, igual que en la base de datos. */}
              {court.is_custom ? (
                <div className="mt-3 overflow-x-auto rounded border border-line bg-elevated/30">
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="border-b border-line text-content-muted">
                        <th className="px-3 py-2 text-left font-medium">Ubicacion del logo</th>
                        {LOGO_BRANDS.map((brand) => (
                          <th key={brand} className="px-3 py-2 text-center font-medium">
                            {LOGO_BRAND_LABEL[brand]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-1.5 text-content-secondary">{pos.name}</td>
                          {LOGO_BRANDS.map((brand) => {
                            const checked = logos.some(
                              (l) =>
                                l.deal_court_id === court.id &&
                                l.brand === brand &&
                                l.logo_position_id === pos.id,
                            );
                            return (
                              <td key={brand} className="px-3 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!editable || isPending}
                                  onChange={(e) =>
                                    toggleLogo(court.id, brand, pos.id, e.target.checked)
                                  }
                                  className="h-4 w-4 accent-[rgb(255,90,0)]"
                                  aria-label={`${LOGO_BRAND_LABEL[brand]} en ${pos.name}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </li>
          ),
        )}

        {adding ? <li>{courtForm(null)}</li> : null}
      </ul>

      {courts.length === 0 && !adding ? (
        <p className="px-4 py-6 text-center text-sm text-content-muted">
          Todavia no hay canchas en este negocio.
        </p>
      ) : null}

      {editable && !adding ? (
        <div className="border-t border-line px-4 py-3">
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary">
            <Plus size={15} />
            Anadir cancha
          </button>
        </div>
      ) : null}
    </Card>
  );
}
