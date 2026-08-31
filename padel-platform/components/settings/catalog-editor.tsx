'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  saveCourtModel, saveLightPostColor, saveLogoPosition, saveTurfColor, setCatalogItemActive,
} from '@/actions/deals';
import { formatMoney } from '@/lib/format';
import { Card, SectionTitle } from '@/components/ui';
import { PREVIEW_COURT_TYPES, type CatalogTable } from '@/lib/validations/deals';
import type { ColorOption, CourtModel, LogoPosition } from '@/types/database.types';

type Row = (CourtModel | LogoPosition | ColorOption) & {
  default_commission_usd?: number;
  preview_court_type?: string;
  description?: string | null;
  hex?: string | null;
};

const SAVE_ACTION = {
  court_models: saveCourtModel,
  logo_positions: saveLogoPosition,
  turf_colors: saveTurfColor,
  light_post_colors: saveLightPostColor,
} as const;

const PLACEHOLDER = {
  court_models: { name: 'Atila Pro', code: 'ATILA_PRO' },
  logo_positions: { name: 'Postes de luz', code: 'POSTES_LUZ' },
  turf_colors: { name: 'Gris oscuro', code: 'GRIS_OSCURO' },
  light_post_colors: { name: 'Negro', code: 'NEGRO' },
} as const;

const PREVIEW_TYPE_LABEL: Record<string, string> = {
  panoramica: 'Panoramica',
  semi: 'Semi panoramica',
  normal: 'Normal',
};

/**
 * Editor de un catalogo del proyecto.
 *
 * Tipos de cancha, ubicaciones de logo y cartas de color son datos, no
 * codigo: renombrar "Atila Pro" o anadir un color se hace aqui y surte
 * efecto en el siguiente render, sin desplegar nada.
 *
 * Nada se borra: una entrada usada por negocios historicos se desactiva,
 * porque eliminarla falsearia lo que se vendio en su dia (§83).
 */
export function CatalogEditor({
  projectCode,
  kind,
  title,
  description,
  rows,
  editable,
}: {
  projectCode: string;
  kind: CatalogTable;
  title: string;
  description: string;
  rows: Row[];
  editable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCourtModel = kind === 'court_models';
  const isColor = kind === 'turf_colors' || kind === 'light_post_colors';
  const save = SAVE_ACTION[kind];
  const hint = PLACEHOLDER[kind];

  function submit(formData: FormData, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await save(null, formData);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  function toggleActive(id: string, active: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCatalogItemActive(projectCode, kind, id, active);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const rowForm = (row: Row | null) => (
    <form
      action={(formData) => submit(formData, () => (row ? setEditingId(null) : setAdding(false)))}
      className="grid grid-cols-12 items-end gap-2 border-b border-line bg-elevated/30 px-4 py-3"
    >
      <input type="hidden" name="projectCode" value={projectCode} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <input type="hidden" name="active" value="true" />

      <div className="col-span-12 sm:col-span-4">
        <label className="label">Nombre</label>
        <input
          type="text" name="name" required defaultValue={row?.name ?? ''}
          placeholder={hint.name} className="input"
        />
      </div>

      <div className="col-span-6 sm:col-span-3">
        <label className="label">Codigo</label>
        <input
          type="text" name="code" required defaultValue={row?.code ?? ''}
          placeholder={hint.code} className="input uppercase" readOnly={Boolean(row)}
        />
      </div>

      {isColor ? (
        <div className="col-span-6 sm:col-span-3">
          <label className="label">Color</label>
          <input
            type="color" name="hex" defaultValue={row?.hex ?? '#1F4FD8'}
            className="input h-[38px] cursor-pointer p-1"
          />
        </div>
      ) : null}

      {isCourtModel ? (
        <>
          <div className="col-span-6 sm:col-span-3">
            <label className="label">Comision por defecto (USD)</label>
            <input
              type="number" name="default_commission_usd" step="0.01" min={0}
              defaultValue={(row as CourtModel | null)?.default_commission_usd ?? 1700}
              className="input tabular"
            />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="label">Tipo en la vista 3D</label>
            <select
              name="preview_court_type"
              defaultValue={(row as CourtModel | null)?.preview_court_type ?? 'panoramica'}
              className="input"
            >
              {PREVIEW_COURT_TYPES.map((t) => (
                <option key={t} value={t}>{PREVIEW_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div className="col-span-6 sm:col-span-2">
        <label className="label">Orden</label>
        <input
          type="number" name="sort_order" min={0} defaultValue={row?.sort_order ?? 100}
          className="input tabular"
        />
      </div>

      {isCourtModel ? (
        <div className="col-span-12">
          <label className="label">Descripcion</label>
          <input
            type="text" name="description"
            defaultValue={(row as CourtModel | null)?.description ?? ''}
            className="input"
          />
        </div>
      ) : null}

      <div className="col-span-12 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => (row ? setEditingId(null) : setAdding(false))}
          className="btn-secondary"
        >
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          {row ? 'Guardar' : 'Anadir'}
        </button>
      </div>
    </form>
  );

  return (
    <Card padded={false}>
      <div className="px-4 pt-4">
        <SectionTitle>{title}</SectionTitle>
        <p className="mb-3 text-2xs text-content-muted">{description}</p>
      </div>

      {error ? (
        <div role="alert" className="mx-4 mb-3 flex items-start gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <ul className="divide-y divide-line border-t border-line">
        {rows.map((row) =>
          editingId === row.id ? (
            <li key={row.id}>{rowForm(row)}</li>
          ) : (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex items-center gap-2.5">
                {isColor ? (
                  <span
                    className="h-5 w-5 shrink-0 rounded border border-line-strong"
                    style={{ background: row.hex ?? 'transparent' }}
                    aria-hidden="true"
                  />
                ) : null}
                <span>
                  <span className={`text-sm ${row.active ? '' : 'text-content-muted line-through'}`}>
                    {row.name}
                  </span>
                  <span className="block text-2xs text-content-muted">
                    {row.code}
                    {isCourtModel
                      ? ` · ${formatMoney((row as CourtModel).default_commission_usd, 'USD')} · ${
                          PREVIEW_TYPE_LABEL[(row as CourtModel).preview_court_type] ?? ''
                        }`
                      : ''}
                    {isColor && row.hex ? ` · ${row.hex.toUpperCase()}` : ''}
                  </span>
                </span>
              </span>

              {editable ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button" onClick={() => setEditingId(row.id)}
                    className="btn-secondary px-2 py-1" title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button" onClick={() => toggleActive(row.id, !row.active)}
                    disabled={isPending} className="btn-secondary px-2 py-1"
                    title={row.active ? 'Desactivar' : 'Reactivar'}
                  >
                    {row.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  </button>
                </span>
              ) : null}
            </li>
          ),
        )}

        {adding ? <li>{rowForm(null)}</li> : null}
      </ul>

      {editable && !adding ? (
        <div className="border-t border-line px-4 py-3">
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary">
            <Plus size={15} />
            Anadir
          </button>
        </div>
      ) : null}
    </Card>
  );
}
