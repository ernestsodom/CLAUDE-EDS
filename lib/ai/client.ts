import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

/**
 * Acceso al proveedor de IA (FASE 14).
 *
 * Reglas de la casa:
 *
 *  - La clave vive SOLO en el entorno del servidor. Este modulo importa
 *    `server-only`, asi que el build falla si alguien lo arrastra a un
 *    componente de cliente en lugar de filtrar la clave en un bundle.
 *  - La IA es opcional. Sin clave configurada la aplicacion funciona
 *    entera; solo desaparecen las pantallas de IA. Nada del negocio
 *    depende de que un modelo responda.
 *  - La IA nunca escribe en el negocio por su cuenta: propone. Lo impone
 *    un constraint en PostgreSQL, no una convencion de este fichero.
 */

export const AI_MODEL = 'claude-opus-5';

/** El proveedor esta configurado. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY ?? process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  const apiKey = process.env.AI_PROVIDER_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'La IA no esta configurada. Define AI_PROVIDER_API_KEY en el entorno del servidor.',
    );
  }
  client ??= new Anthropic({ apiKey });
  return client;
}

/**
 * Texto de una respuesta, ignorando bloques de pensamiento y de
 * herramienta.
 */
export function textOf(message: { content: { type: string; text?: string }[] }): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
}

/** Mensaje unico para cuando el modelo se niega a responder. */
export const REFUSAL_MESSAGE =
  'El modelo no ha querido procesar este contenido. Revisa el documento manualmente.';
