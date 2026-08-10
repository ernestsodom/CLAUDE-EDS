'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProject } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { downloadObject } from '@/lib/services/storage';
import { isAiEnabled } from '@/lib/ai/client';
import {
  PROMPT_VERSION, completenessScore, extractDocument, type ExtractionType,
} from '@/lib/ai/extraction';
import { askAssistant, type AssistantAnswer } from '@/lib/ai/assistant';
import { InvoiceExtractionApplySchema } from '@/lib/validations/documents';
import { formToObject } from '@/lib/services/persist';
import { failure, success, toUserMessage, type ActionResult } from '@/actions/types';

type FormState = ActionResult<{ id: string }> | null;

/**
 * Server Actions de IA (FASE 14).
 *
 * Todo lo que hay aqui respeta dos limites:
 *
 *  - La clave del proveedor nunca sale del servidor.
 *  - La IA propone; una persona aprueba; solo entonces se escribe en el
 *    negocio. El orden lo impone `ai_extractions_applied_ck` y las
 *    funciones `review_ai_extraction` / `mark_ai_extraction_applied`,
 *    no la buena voluntad de este fichero.
 */

// =====================================================================
// 1) Extraccion
// =====================================================================
export async function runDocumentExtraction(
  projectCode: string,
  documentId: string,
): Promise<ActionResult<{ id: string; status: string }>> {
  const { project } = await requireProject(projectCode);

  if (!can(project, 'ai.create')) {
    return failure('No tienes permiso para lanzar extracciones de IA en este proyecto.');
  }
  if (!isAiEnabled()) {
    return failure('La IA no esta configurada en este entorno. Avisa al administrador.');
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from('documents')
    .select('id, name, bucket, storage_path, mime_type, document_types(ai_extraction_type)')
    .eq('id', documentId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .maybeSingle();

  const doc = data as unknown as {
    id: string; name: string; bucket: string; storage_path: string; mime_type: string | null;
    document_types: { ai_extraction_type: string | null } | null;
  } | null;

  if (!doc) return failure('El documento no existe o no tienes acceso a el.');

  const type = doc.document_types?.ai_extraction_type as ExtractionType | null;
  if (!type) {
    return failure('Este tipo de documento no admite extraccion automatica.');
  }

  // La fila se crea antes de llamar al modelo: si la llamada se cae, queda
  // constancia del intento en lugar de desaparecer sin rastro.
  const { data: row, error: insertError } = await supabase
    .from('ai_document_extractions')
    .insert({
      project_id: project.id,
      document_id: documentId,
      provider: 'anthropic',
      model: 'claude-opus-5',
      extraction_type: type,
      prompt_version: PROMPT_VERSION,
      status: 'PROCESANDO',
    })
    .select('id')
    .single();

  if (insertError || !row) return failure(toUserMessage(insertError?.message ?? ''));

  const file = await downloadObject(doc.bucket, doc.storage_path);
  if (!file.ok) {
    await supabase.from('ai_document_extractions')
      .update({ status: 'ERROR', error_message: file.error })
      .eq('id', row.id);
    return failure('No se ha podido leer el archivo desde Storage.');
  }

  const outcome = await extractDocument({
    bytes: file.bytes,
    mimeType: doc.mime_type ?? file.mimeType,
    fileName: doc.name,
    extractionType: type,
  });

  if (!outcome.ok || !outcome.data) {
    await supabase.from('ai_document_extractions')
      .update({
        status: 'ERROR',
        error_message: outcome.error ?? 'Error desconocido',
        raw_response: outcome.raw ? { raw: outcome.raw } : null,
      })
      .eq('id', row.id);
    return failure(outcome.error ?? 'La extraccion ha fallado.');
  }

  await supabase.from('ai_document_extractions')
    .update({
      status: 'EXTRAIDO',
      structured_data: outcome.data,
      raw_response: outcome.raw as never,
      confidence: completenessScore(type, outcome.data),
      tokens_input: outcome.tokensInput ?? null,
      tokens_output: outcome.tokensOutput ?? null,
    })
    .eq('id', row.id);

  revalidatePath(`/${projectCode}/documentos/${documentId}`);
  revalidatePath(`/${projectCode}/ia`);

  return success(
    { id: row.id, status: 'EXTRAIDO' },
    'Extraccion lista. Revisala antes de aplicar nada al negocio.',
  );
}

// =====================================================================
// 2) Revision humana (§42)
// =====================================================================
export async function reviewExtraction(input: {
  projectCode: string;
  extractionId: string;
  approve: boolean;
  comment?: string;
  documentId?: string;
}): Promise<ActionResult<null>> {
  const { projectCode, extractionId, approve, comment, documentId } = input;
  await requireProject(projectCode);

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_ai_extraction', {
    p_extraction_id: extractionId,
    p_approve: approve,
    p_comment: comment ?? null,
  });

  if (error) {
    // Los mensajes de la funcion ya estan escritos para una persona.
    const raw = error.message ?? '';
    if (/permiso|revisada|terminada|identificado/i.test(raw)) {
      return failure(raw.replace(/^.*?:\s*/, ''));
    }
    return failure(toUserMessage(raw));
  }

  revalidatePath(`/${projectCode}/ia`);
  if (documentId) revalidatePath(`/${projectCode}/documentos/${documentId}`);

  return success(
    null,
    approve
      ? 'Extraccion aprobada. Ya puede aplicarse al negocio.'
      : 'Extraccion rechazada. No se aplicara nada.',
  );
}

// =====================================================================
// 3) Aplicacion al negocio
//
// Lo que se escribe son los valores que la persona confirmo en el
// formulario de revision, NO el JSON del modelo. La extraccion aporta el
// borrador; la responsabilidad del dato sigue siendo humana.
// =====================================================================
export async function applyInvoiceExtraction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectCode = String(formData.get('projectCode') ?? '');
  const { project, session } = await requireProject(projectCode);

  if (!can(project, 'invoices.create')) {
    return failure('No tienes permiso para crear facturas en este proyecto.');
  }

  const parsed = InvoiceExtractionApplySchema.safeParse(
    formToObject(formData, { numbers: ['subtotal', 'tax_rate'] }),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(issue?.message ?? 'Datos invalidos');
  }
  const values = parsed.data;

  const supabase = await createClient();

  // La extraccion tiene que estar aprobada. Se comprueba antes de crear
  // nada para no dejar una factura huerfana si la validacion falla.
  const { data: extraction } = await supabase
    .from('ai_document_extractions')
    .select('id, status, applied_at, document_id')
    .eq('id', values.extraction_id)
    .eq('project_id', project.id)
    .maybeSingle();

  if (!extraction) return failure('La extraccion no existe o no tienes acceso.');
  if (extraction.status !== 'APROBADO') {
    return failure('Esta extraccion todavia no la ha aprobado nadie. Revisala primero.');
  }
  if (extraction.applied_at) return failure('Esta extraccion ya se habia aplicado.');

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      project_id: project.id,
      kind: values.kind,
      external_number: values.external_number,
      invoice_date: values.invoice_date,
      due_date: values.due_date ?? null,
      currency: values.currency,
      tax_rate: values.tax_rate,
      client_id: values.client_id ?? null,
      supplier_id: values.supplier_id ?? null,
      sale_id: values.sale_id ?? null,
      status: 'BORRADOR',
      notes: values.notes ?? null,
      created_by: session.user?.id ?? null,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) return failure(toUserMessage(invoiceError?.message ?? ''));

  // El total de la factura lo calcula un trigger desde sus lineas, asi
  // que la base imponible entra como linea y no como campo de cabecera.
  const { error: itemError } = await supabase.from('invoice_items').insert({
    project_id: project.id,
    invoice_id: invoice.id,
    description: `Segun documento ${values.external_number}`,
    quantity: 1,
    unit_price: values.subtotal,
  });

  if (itemError) return failure(toUserMessage(itemError.message));

  const { error: markError } = await supabase.rpc('mark_ai_extraction_applied', {
    p_extraction_id: values.extraction_id,
    p_entity_type: 'INVOICE',
    p_entity_id: invoice.id,
  });

  if (markError) {
    // La factura existe: no se borra por un fallo de trazabilidad, se
    // informa para que quede claro que la marca no se pudo escribir.
    return failure(
      `La factura se creo, pero no se pudo marcar la extraccion como aplicada: ${toUserMessage(markError.message)}`,
    );
  }

  revalidatePath(`/${projectCode}/finanzas/facturas`);
  revalidatePath(`/${projectCode}/ia`);
  if (extraction.document_id) revalidatePath(`/${projectCode}/documentos/${extraction.document_id}`);

  return success({ id: invoice.id }, 'Factura creada en borrador desde el documento.');
}

// =====================================================================
// 4) Asistente
//
// La consulta se ejecuta con el cliente de la sesion del usuario, nunca
// con service role: RLS decide que datos entran en la respuesta. Es lo
// que hace que el asistente no pueda contar de una unidad de negocio a
// quien no tiene acceso a ella.
// =====================================================================
export async function askAssistantAction(input: {
  projectCode: string;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<ActionResult<AssistantAnswer>> {
  const { project } = await requireProject(input.projectCode);

  if (!can(project, 'ai.view')) {
    return failure('No tienes permiso para usar el asistente en este proyecto.');
  }
  if (!isAiEnabled()) {
    return failure('La IA no esta configurada en este entorno.');
  }

  const question = input.question.trim();
  if (!question) return failure('Escribe una pregunta.');
  if (question.length > 2000) return failure('La pregunta es demasiado larga.');

  const supabase = await createClient();

  const answer = await askAssistant({
    supabase,
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code,
    question,
    history: input.history,
  });

  return success(answer);
}
