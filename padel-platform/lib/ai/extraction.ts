import 'server-only';

import { AI_MODEL, REFUSAL_MESSAGE, getAiClient, textOf } from '@/lib/ai/client';

/**
 * Document Intelligence (FASE 14, §42).
 *
 * Extrae datos estructurados de facturas, BL, contratos y cotizaciones.
 * Lo que produce este modulo es SIEMPRE una propuesta: se guarda en
 * `ai_document_extractions` con estado EXTRAIDO y ahi se queda hasta que
 * una persona con permiso la revisa. `ai_extractions_applied_ck` impide a
 * nivel de base marcar como aplicada una extraccion no aprobada.
 *
 * El esquema de salida se declara en `output_config.format`, asi que la
 * respuesta ya viene validada contra el esquema y no hace falta parsear
 * texto libre ni rezar para que el JSON venga bien cerrado.
 */

export type ExtractionType = 'INVOICE' | 'BL' | 'CONTRACT' | 'QUOTE';

/** Formatos que el modelo puede leer directamente. */
const DOCUMENT_MIME = new Set(['application/pdf']);
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const SCHEMAS: Record<ExtractionType, Record<string, unknown>> = {
  INVOICE: {
    type: 'object',
    properties: {
      invoice_number: { type: ['string', 'null'], description: 'Numero de la factura tal como aparece' },
      invoice_date: { type: ['string', 'null'], description: 'Fecha de emision en formato YYYY-MM-DD' },
      due_date: { type: ['string', 'null'], description: 'Fecha de vencimiento en formato YYYY-MM-DD' },
      issuer_name: { type: ['string', 'null'], description: 'Razon social de quien emite' },
      issuer_tax_id: { type: ['string', 'null'], description: 'CIF/NIF/CUIT del emisor' },
      recipient_name: { type: ['string', 'null'] },
      recipient_tax_id: { type: ['string', 'null'] },
      currency: { type: ['string', 'null'], description: 'Codigo ISO: EUR, USD, ARS o CLP' },
      subtotal: { type: ['number', 'null'], description: 'Base imponible' },
      tax_rate: { type: ['number', 'null'], description: 'Porcentaje de impuesto, 21 para 21%' },
      tax_amount: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unit_price: { type: ['number', 'null'] },
            total: { type: ['number', 'null'] },
          },
          required: ['description'],
          additionalProperties: false,
        },
      },
      notes: { type: ['string', 'null'] },
    },
    required: ['invoice_number', 'invoice_date', 'total', 'line_items'],
    additionalProperties: false,
  },

  BL: {
    type: 'object',
    properties: {
      bl_number: { type: ['string', 'null'] },
      carrier: { type: ['string', 'null'] },
      vessel: { type: ['string', 'null'] },
      container_numbers: { type: 'array', items: { type: 'string' } },
      port_of_loading: { type: ['string', 'null'] },
      port_of_discharge: { type: ['string', 'null'] },
      departure_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      arrival_date: { type: ['string', 'null'], description: 'YYYY-MM-DD estimada' },
      shipper: { type: ['string', 'null'] },
      consignee: { type: ['string', 'null'] },
      gross_weight_kg: { type: ['number', 'null'] },
      package_count: { type: ['number', 'null'] },
      goods_description: { type: ['string', 'null'] },
    },
    required: ['bl_number', 'port_of_loading', 'port_of_discharge'],
    additionalProperties: false,
  },

  CONTRACT: {
    type: 'object',
    properties: {
      contract_number: { type: ['string', 'null'] },
      title: { type: ['string', 'null'] },
      parties: { type: 'array', items: { type: 'string' } },
      signature_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      start_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      end_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      total_amount: { type: ['number', 'null'] },
      currency: { type: ['string', 'null'] },
      payment_terms: { type: ['string', 'null'] },
      penalties: { type: ['string', 'null'], description: 'Penalizaciones por retraso o incumplimiento' },
      warranty_months: { type: ['number', 'null'] },
      key_obligations: { type: 'array', items: { type: 'string' } },
    },
    required: ['parties'],
    additionalProperties: false,
  },

  QUOTE: {
    type: 'object',
    properties: {
      quote_number: { type: ['string', 'null'] },
      supplier_name: { type: ['string', 'null'] },
      quote_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      valid_until: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      currency: { type: ['string', 'null'] },
      total: { type: ['number', 'null'] },
      lead_time_days: { type: ['number', 'null'] },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unit_price: { type: ['number', 'null'] },
            total: { type: ['number', 'null'] },
          },
          required: ['description'],
          additionalProperties: false,
        },
      },
    },
    required: ['line_items'],
    additionalProperties: false,
  },
};

const INSTRUCTIONS: Record<ExtractionType, string> = {
  INVOICE: 'una factura comercial',
  BL: 'un Bill of Lading (conocimiento de embarque)',
  CONTRACT: 'un contrato',
  QUOTE: 'una cotizacion de proveedor',
};

const SYSTEM_PROMPT = `Extraes datos estructurados de documentos del negocio de fabricacion y venta de canchas de padel.

Reglas:
- Transcribe lo que el documento dice. No completes, no deduzcas y no calcules valores que no aparezcan.
- Un campo que no figure en el documento va a null. Un null es una respuesta correcta; un dato inventado no lo es.
- Las fechas, siempre en formato YYYY-MM-DD. Si el documento usa DD/MM/AAAA, conviertelo respetando ese orden.
- Los importes, como numeros sin simbolo de moneda ni separador de miles.
- Si el documento esta ilegible, en blanco o no es del tipo esperado, deja los campos en null.

Lo que extraigas lo va a revisar una persona antes de que entre en el sistema. Prioriza no equivocarte sobre rellenar campos.`;

export interface ExtractionOutcome {
  ok: boolean;
  data?: Record<string, unknown>;
  raw?: unknown;
  error?: string;
  model: string;
  promptVersion: string;
  tokensInput?: number;
  tokensOutput?: number;
}

export const PROMPT_VERSION = 'extract-v1';

/**
 * Lanza la extraccion sobre el contenido binario del documento.
 *
 * El fichero llega en memoria desde Storage: no se expone ninguna URL
 * publica ni se le pide al modelo que descargue nada.
 */
export async function extractDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  extractionType: ExtractionType;
}): Promise<ExtractionOutcome> {
  const { bytes, mimeType, fileName, extractionType } = input;
  const base = { model: AI_MODEL, promptVersion: PROMPT_VERSION };

  const isDocument = DOCUMENT_MIME.has(mimeType);
  const isImage = IMAGE_MIME.has(mimeType);

  if (!isDocument && !isImage) {
    return {
      ...base,
      ok: false,
      error: `No puedo leer archivos ${mimeType || 'de este tipo'}. La extraccion admite PDF e imagenes.`,
    };
  }

  const data = Buffer.from(bytes).toString('base64');

  try {
    const message = await getAiClient().messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        format: {
          type: 'json_schema',
          schema: SCHEMAS[extractionType],
        },
      },
      messages: [{
        role: 'user',
        content: [
          isDocument
            ? {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data },
              }
            : {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                  data,
                },
              },
          {
            type: 'text',
            text: `Este archivo se llama "${fileName}" y deberia ser ${INSTRUCTIONS[extractionType]}. Extrae sus datos siguiendo el esquema.`,
          },
        ],
      }],
    });

    if (message.stop_reason === 'refusal') {
      return { ...base, ok: false, error: REFUSAL_MESSAGE };
    }

    const text = textOf(message as never);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        ...base,
        ok: false,
        error: 'La respuesta del modelo no ha llegado en el formato esperado.',
        raw: text,
      };
    }

    return {
      ...base,
      ok: true,
      data: parsed,
      raw: { stop_reason: message.stop_reason, content: message.content },
      tokensInput: message.usage?.input_tokens,
      tokensOutput: message.usage?.output_tokens,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error
        ? `El proveedor de IA ha devuelto un error: ${error.message}`
        : 'El proveedor de IA no ha respondido.',
    };
  }
}

/**
 * Confianza estimada.
 *
 * No se le pide al modelo que puntue su propia certeza —un numero que se
 * inventa el mismo que se pudo equivocar no informa de nada—: se mide
 * cuantos campos obligatorios del esquema ha podido rellenar. Es una
 * senal de completitud, y como tal se presenta en pantalla.
 */
export function completenessScore(
  extractionType: ExtractionType,
  data: Record<string, unknown>,
): number {
  const schema = SCHEMAS[extractionType] as { required?: string[] };
  const required = schema.required ?? [];
  if (required.length === 0) return 1;

  const filled = required.filter((field) => {
    const value = data[field];
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;

  return Math.round((filled / required.length) * 10000) / 10000;
}
