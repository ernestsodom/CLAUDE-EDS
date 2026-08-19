import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { withErrorHandling, ValidationError } from "@/lib/errors";
import {
  CHAT_ENGINES,
  CITATION_DELIMITER,
  splitAnswerAndCitations,
  streamChatTurn,
} from "@/core/services/chat.service";
import {
  appendMessage,
  getHistory,
  getOrCreateConversation,
} from "@/core/repositories/conversations.repo";
import { audit } from "@/core/services/audit.service";
import { usageLogger } from "@/core/services/ai-usage.service";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  documentId: z.string().uuid().nullable().default(null),
  agent: z.enum(["analista", "comparador", "reclamos", "propuestas", "comercial"]).default("analista"),
  // Motor elegido por el usuario. Sin valor, se usa el primero configurado.
  engine: z.enum(CHAT_ENGINES).optional(),
  question: z.string().min(1).max(8000),
  filters: z
    .object({
      docType: z.string().optional(),
      clientId: z.string().uuid().optional(),
    })
    .optional(),
});

/**
 * POST /api/chat — turno de conversación RAG con streaming SSE.
 * Eventos: `meta` (conversationId), `delta` (texto), `done` (citas + confianza).
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase, user, profile } = await requireUser();
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) throw new ValidationError(parsed.error.message);
  const body = parsed.data;

  const conversation = await getOrCreateConversation(supabase, {
    conversationId: body.conversationId,
    organizationId: profile.organization_id,
    userId: user.id,
    documentId: body.documentId,
    agent: body.agent,
    firstQuestion: body.question,
  });

  const history = await getHistory(supabase, conversation.id);
  await appendMessage(supabase, {
    conversationId: conversation.id,
    role: "user",
    content: body.question,
  });

  const { textStream, engine, model } = await streamChatTurn({
    supabase,
    agent: body.agent,
    question: body.question,
    engine: body.engine,
    history,
    filters: {
      documentIds: body.documentId ? [body.documentId] : undefined,
      docType: body.filters?.docType as never,
      clientId: body.filters?.clientId,
    },
    onUsage: usageLogger({
      organizationId: profile.organization_id,
      documentId: body.documentId,
      userId: user.id,
      feature: "chat",
    }),
  });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  const readable = new ReadableStream({
    async start(controller) {
      let full = "";
      let visibleSent = 0;
      try {
        send(controller, "meta", { conversationId: conversation.id, engine, model });

        for await (const delta of textStream) {
          full += delta;
          // No emitir al cliente el bloque de citas: cortar en el delimitador
          const cut = full.indexOf(CITATION_DELIMITER);
          const visible = cut === -1 ? full : full.slice(0, cut);
          if (visible.length > visibleSent) {
            send(controller, "delta", { text: visible.slice(visibleSent) });
            visibleSent = visible.length;
          }
        }

        const { answer, citations, confidence } = splitAnswerAndCitations(full);
        await appendMessage(supabase, {
          conversationId: conversation.id,
          role: "assistant",
          content: answer,
          citations,
          confidence,
          model,
        });
        await audit(profile.organization_id, user.id, "chat.message", "conversation", conversation.id);

        send(controller, "done", { citations, confidence, engine, model });
      } catch (err) {
        send(controller, "error", { message: err instanceof Error ? err.message : "Error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
