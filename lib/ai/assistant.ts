import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, REFUSAL_MESSAGE, getAiClient, textOf } from '@/lib/ai/client';

/**
 * Asistente de negocio (FASE 14, §44).
 *
 * Dos decisiones sostienen esta pantalla:
 *
 *  1. **El asistente no tiene acceso propio a los datos.** Cada
 *     herramienta ejecuta una consulta parametrizada con el cliente
 *     Supabase del usuario que pregunta, asi que RLS filtra igual que en
 *     cualquier otra pantalla. Un comercial de EUROPA no puede sacar por
 *     aqui las ventas de ATILA aunque lo pida explicitamente: no es que
 *     el modelo se niegue, es que la base no se las devuelve.
 *
 *  2. **No hay SQL generado por el modelo.** El repertorio de consultas
 *     es cerrado y esta escrito aqui. El modelo elige cual usar y con que
 *     parametros; no redacta la consulta. Eso elimina de raiz la
 *     inyeccion y las consultas accidentalmente carisimas.
 *
 * Si una pregunta no se puede responder con estas herramientas, el
 * asistente lo dice. No completa con conocimiento general ni con
 * suposiciones.
 */

const MAX_ROWS = 40;
const MAX_TURNS = 6;

export interface AssistantSource {
  tool: string;
  rows: number;
}

export interface AssistantAnswer {
  ok: boolean;
  text: string;
  sources: AssistantSource[];
  error?: string;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_ventas',
    description:
      'Ventas del proyecto con su situacion economica: total, costo, margen proyectado, ' +
      'facturado, cobrado y canchas entregadas. Usar para preguntas sobre ventas, margenes ' +
      'o estado de entrega.',
    input_schema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          description: 'Filtra por estado de la venta, p.ej. COTIZACION, CONFIRMADA, EN_PRODUCCION, ENTREGADA',
        },
        cliente: { type: 'string', description: 'Parte del nombre del cliente' },
        solo_margen_bajo: { type: 'boolean', description: 'Solo ventas marcadas como margen bajo' },
        limite: { type: 'integer', description: 'Maximo de filas, por defecto 15' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'resumen_financiero',
    description:
      'Cifras agregadas del proyecto: facturado, cobrado, cuentas por cobrar, cuentas por ' +
      'pagar y gastos. Usar para preguntas de "cuanto llevamos" o "como vamos".',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'rentabilidad',
    description:
      'Rentabilidad agregada del proyecto: ingresos, costos, margen estimado, real y ' +
      'proyectado, y cuantas ventas tienen margen bajo.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'estado_fabricacion',
    description:
      'Proyectos de fabricacion con su avance, canchas construidas, materiales faltantes ' +
      'y si van retrasados.',
    input_schema: {
      type: 'object',
      properties: {
        solo_retrasados: { type: 'boolean', description: 'Solo los que van fuera de plazo' },
        limite: { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'cuentas_por_cobrar',
    description:
      'Facturas de venta con saldo pendiente, con dias de retraso y tramo de antiguedad.',
    input_schema: {
      type: 'object',
      properties: {
        solo_vencidas: { type: 'boolean' },
        cliente: { type: 'string' },
        limite: { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'alertas_abiertas',
    description:
      'Alertas activas del Control Center: fabricacion atrasada, material faltante, ' +
      'facturas vencidas, margen bajo, entregas atrasadas y demas.',
    input_schema: {
      type: 'object',
      properties: {
        prioridad: { type: 'string', description: 'BAJA, MEDIA, ALTA o CRITICA' },
        limite: { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'buscar_clientes',
    description:
      'Clientes con su vision 360: oportunidades abiertas, ventas, importe vendido, ' +
      'saldo pendiente y ultima actividad.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte del nombre de la empresa' },
        limite: { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'inventario_usadas',
    description:
      'Inventario de canchas usadas con costo de compra, refurbishment, precio de venta y margen.',
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'integer' } },
      additionalProperties: false,
    },
  },
];

type Executor = (
  supabase: SupabaseClient,
  projectId: string,
  input: Record<string, unknown>,
) => Promise<unknown[]>;

const limitOf = (input: Record<string, unknown>, fallback = 15) =>
  Math.min(Number(input.limite ?? fallback) || fallback, MAX_ROWS);

const EXECUTORS: Record<string, Executor> = {
  async consultar_ventas(supabase, projectId, input) {
    let query = supabase
      .from('v_sale_financials')
      .select('sale_number, sale_date, status, client_name, currency, total_sale,' +
              ' projected_cost, projected_margin, projected_margin_percentage,' +
              ' invoiced_amount, collected_amount, receivable_amount,' +
              ' courts_total, courts_delivered, delivery_state, is_low_margin, has_actual_cost')
      .eq('project_id', projectId)
      .order('sale_date', { ascending: false })
      .limit(limitOf(input));

    if (typeof input.estado === 'string' && input.estado) query = query.eq('status', input.estado);
    if (typeof input.cliente === 'string' && input.cliente) {
      query = query.ilike('client_name', `%${input.cliente.replace(/[%,()]/g, ' ')}%`);
    }
    if (input.solo_margen_bajo === true) query = query.eq('is_low_margin', true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async resumen_financiero(supabase, projectId) {
    const { data, error } = await supabase
      .from('v_financial_summary')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async rentabilidad(supabase, projectId) {
    const { data, error } = await supabase
      .from('v_project_profitability')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async estado_fabricacion(supabase, projectId, input) {
    let query = supabase
      .from('v_manufacturing_summary')
      .select('name, status, priority, start_date, estimated_completion_date,' +
              ' courts_count, courts_built, progress_pct, materials_missing,' +
              ' is_delayed, days_to_deadline')
      .eq('project_id', projectId)
      .order('estimated_completion_date', { ascending: true, nullsFirst: false })
      .limit(limitOf(input));

    if (input.solo_retrasados === true) query = query.eq('is_delayed', true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async cuentas_por_cobrar(supabase, projectId, input) {
    let query = supabase
      .from('v_accounts_receivable')
      .select('invoice_number, invoice_date, due_date, currency, total, paid_amount,' +
              ' balance, status, client_name, sale_number, days_overdue, aging_bucket')
      .eq('project_id', projectId)
      .order('days_overdue', { ascending: false, nullsFirst: false })
      .limit(limitOf(input));

    if (input.solo_vencidas === true) query = query.gt('days_overdue', 0);
    if (typeof input.cliente === 'string' && input.cliente) {
      query = query.ilike('client_name', `%${input.cliente.replace(/[%,()]/g, ' ')}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async alertas_abiertas(supabase, projectId, input) {
    let query = supabase
      .from('alerts')
      .select('alert_type, priority, title, message, entity_type, entity_id, first_detected_at')
      .eq('project_id', projectId)
      .eq('status', 'ABIERTA')
      .order('priority', { ascending: false })
      .limit(limitOf(input, 20));

    if (typeof input.prioridad === 'string' && input.prioridad) {
      query = query.eq('priority', input.prioridad);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async buscar_clientes(supabase, projectId, input) {
    let query = supabase
      .from('v_client_360')
      .select('company_name, country, status, opportunities_count, open_pipeline,' +
              ' sales_count, total_sold, receivable, courts_count, last_activity_at, open_follow_ups')
      .eq('project_id', projectId)
      .order('total_sold', { ascending: false, nullsFirst: false })
      .limit(limitOf(input));

    if (typeof input.texto === 'string' && input.texto) {
      query = query.ilike('company_name', `%${input.texto.replace(/[%,()]/g, ' ')}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async inventario_usadas(supabase, projectId, input) {
    const { data, error } = await supabase
      .from('v_used_courts_inventory')
      .select('*')
      .eq('project_id', projectId)
      .limit(limitOf(input));
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

function systemPrompt(projectName: string, projectCode: string, today: string): string {
  return `Eres el asistente de la plataforma de gestion del negocio de canchas de padel.

Contexto de esta conversacion:
- Unidad de negocio: ${projectName} (${projectCode})
- Fecha de hoy: ${today}

Como trabajas:
- Respondes UNICAMENTE con lo que devuelven las herramientas. No tienes memoria del negocio ni conocimiento previo de esta empresa.
- Si una herramienta no devuelve filas, dilo con claridad: "no encuentro ningun registro de X". No rellenes el hueco con suposiciones ni con ejemplos.
- Si la pregunta no se puede responder con las herramientas disponibles, explica que dato falta y donde podria mirarlo la persona.
- No inventes cifras, nombres, fechas ni numeros de documento. Si un importe no aparece en los datos, no lo estimes.
- Las herramientas solo devuelven lo que esta persona tiene permiso de ver. Si algo no aparece, puede ser que no exista o que quede fuera de su acceso: no lo presentes como una certeza sobre el negocio entero.

Como respondes:
- En espanol, directo y breve. Cifras con su moneda.
- Cuando cites datos, di de donde salen ("segun cuentas por cobrar...").
- Nada de disculpas ni de preambulos. Responde la pregunta.`;
}

/**
 * Responde una pregunta consultando datos reales.
 *
 * `supabase` debe ser el cliente de la sesion del usuario. Pasar aqui un
 * cliente con service role romperia el aislamiento entre unidades de
 * negocio: la funcion no lo comprueba porque no puede, asi que la regla
 * se cumple en la Server Action que la llama.
 */
export async function askAssistant(input: {
  supabase: SupabaseClient;
  projectId: string;
  projectName: string;
  projectCode: string;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<AssistantAnswer> {
  const { supabase, projectId, projectName, projectCode, question, history = [] } = input;
  const sources: AssistantSource[] = [];

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })) as Anthropic.MessageParam[],
    { role: 'user', content: question },
  ];

  try {
    const client = getAiClient();

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const message = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4000,
        system: systemPrompt(projectName, projectCode, new Date().toISOString().slice(0, 10)),
        thinking: { type: 'adaptive' },
        tools: TOOLS,
        messages,
      });

      if (message.stop_reason === 'refusal') {
        return { ok: false, text: REFUSAL_MESSAGE, sources, error: REFUSAL_MESSAGE };
      }

      if (message.stop_reason !== 'tool_use') {
        return { ok: true, text: textOf(message as never), sources };
      }

      messages.push({ role: 'assistant', content: message.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== 'tool_use') continue;

        const executor = EXECUTORS[block.name];
        if (!executor) {
          results.push({
            type: 'tool_result', tool_use_id: block.id, is_error: true,
            content: 'Esa herramienta no existe.',
          });
          continue;
        }

        try {
          const rows = await executor(supabase, projectId, (block.input ?? {}) as Record<string, unknown>);
          sources.push({ tool: block.name, rows: rows.length });
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: rows.length === 0
              ? 'Sin resultados: la consulta no ha devuelto ninguna fila.'
              : JSON.stringify(rows),
          });
        } catch (error) {
          results.push({
            type: 'tool_result', tool_use_id: block.id, is_error: true,
            content: error instanceof Error ? error.message : 'La consulta ha fallado.',
          });
        }
      }

      messages.push({ role: 'user', content: results });
    }

    return {
      ok: false,
      text: 'La consulta se ha vuelto demasiado larga. Prueba a preguntar algo mas concreto.',
      sources,
      error: 'Limite de iteraciones alcanzado.',
    };
  } catch (error) {
    return {
      ok: false,
      text: 'No he podido consultar los datos en este momento.',
      sources,
      error: error instanceof Error ? error.message : 'Error desconocido.',
    };
  }
}
