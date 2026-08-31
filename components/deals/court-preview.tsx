'use client';

import { useState } from 'react';
import { Box, ExternalLink, X } from 'lucide-react';

/**
 * Visualizador 3D de muestra.
 *
 * No dibuja la cancha: la dibuja PadelStudio, el configurador 3D que ya
 * existe (https://padelstudio-theta.vercel.app). Su boton "Compartir"
 * codifica la configuracion en el hash de la URL como JSON en base64, y
 * eso es exactamente lo que se construye aqui con los colores elegidos
 * en el negocio. Reutilizar su visor en lugar de reimplementarlo evita
 * mantener dos motores 3D que acabarian dibujando canchas distintas.
 *
 * Es una IMAGEN DE MUESTRA y la pantalla lo dice de forma visible: sirve
 * para acordar el aspecto con el cliente, no es un plano de fabricacion.
 */

const PADEL_STUDIO_URL = 'https://padelstudio-theta.vercel.app/';

export interface CourtPreviewConfig {
  /** Color de cesped en #RRGGBB. */
  turfHex: string | null;
  /** Color de los postes de luz en #RRGGBB. */
  postHex: string | null;
  /** Geometria del modelo: panoramica | semi | normal. */
  courtType: string;
  /** Nombre del club, que el visor rotula en el vidrio de fondo. */
  club?: string;
}

/** Construye el hash con el formato que PadelStudio ya sabe leer. */
export function buildPreviewHash(config: CourtPreviewConfig): string {
  const payload = {
    tipo: config.courtType,
    entorno: 'estudio',
    momento: 'dia',
    cesped: config.turfHex ?? '#15161a',
    estructura: config.postHex ?? '#0e0f12',
    postesLuz: config.postHex ?? '#0e0f12',
    acento: '#ff5a00',
    lineas: '#ffffff',
    luces: 'curvo',
    logoPos: 'pista',
    logoSize: 2.4,
    club: (config.club ?? '').slice(0, 26),
  };

  // Mismo esquema que usa el boton "Compartir" de PadelStudio:
  // base64(JSON) sobre UTF-8, apto para acentos.
  const json = JSON.stringify(payload);
  const base64 =
    typeof window === 'undefined'
      ? Buffer.from(json, 'utf-8').toString('base64')
      : btoa(String.fromCharCode(...new TextEncoder().encode(json)));

  return `${PADEL_STUDIO_URL}#${base64}`;
}

export function CourtPreview({
  config,
  label,
}: {
  config: CourtPreviewConfig;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const url = buildPreviewHash(config);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary px-2 py-1 text-2xs"
        title="Ver imagen de muestra en 3D"
      >
        <Box size={13} />
        Ver en 3D
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista 3D de muestra · ${label}`}
        >
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />

          <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Vista 3D · {label}</h2>
                <p className="mt-0.5 text-2xs text-content-muted">
                  Imagen de muestra generada con los colores elegidos. Sirve para acordar el
                  aspecto con el cliente; <b>no es un plano de fabricacion</b> y puede diferir del
                  producto final.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary px-2 py-1 text-2xs"
                  title="Abrir en PadelStudio"
                >
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost px-2 py-1"
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <iframe
              src={url}
              title={`Vista 3D de muestra · ${label}`}
              className="flex-1 border-0 bg-black"
              loading="lazy"
              referrerPolicy="no-referrer"
            />

            <div className="border-t border-line bg-elevated/40 px-4 py-2 text-2xs text-content-muted">
              Visualizacion cortesia de <b>PadelStudio</b>. Los colores provienen del catalogo del
              proyecto; el resto de la escena (entorno, iluminacion, precios) es del propio
              configurador y no forma parte del negocio registrado aqui.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
