// Estados posibles de la licitación que agrupa una carpeta — sin dependencias,
// para poder importarse tanto desde Server Actions ("use server" solo puede
// exportar funciones async, no objetos ni arrays) como desde componentes de
// cliente.

export const TENDER_STATUSES = [
  "en_preparacion",
  "publicada",
  "en_evaluacion",
  "adjudicada",
  "cerrada",
  "desierta",
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_LABELS: Record<TenderStatus, string> = {
  en_preparacion: "En preparación",
  publicada: "Publicada",
  en_evaluacion: "En evaluación",
  adjudicada: "Adjudicada",
  cerrada: "Cerrada",
  desierta: "Desierta",
};
