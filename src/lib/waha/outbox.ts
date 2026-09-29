import { db } from "@/lib/db/client";
import { organizations, conversations, messages } from "@/lib/db/schema/index";
import { eq, and } from "drizzle-orm";
import { getQueue, QUEUES } from "@/lib/queue";
import { sendTextMessage } from "@/lib/waha/client";

export interface OutboundMessageParams {
  organizationId: string;
  conversationId: string;
  to: string;
  content: string;
  sentBy: "agent" | "ai" | "system";
  sentByUserId?: string;
}

export interface OutboundJobPayload {
  messageId: string;
  conversationId: string;
  organizationId: string;
  to: string;
  content: string;
  sentBy: "agent" | "ai" | "system";
  controlVersion: string;
}

// ─── Enfileirar mensagem no Outbox ───────────────────────────────────────────

export async function enqueueOutboundMessage(params: OutboundMessageParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const { organizationId, conversationId, to, content, sentBy, sentByUserId } = params;

  // Localizar conversa e capturar controlVersion no momento do agendamento
  const [conv] = await db
    .select({
      id: conversations.id,
      controlVersion: conversations.controlVersion,
      status: conversations.status,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);

  if (!conv) {
    return { success: false, error: "Conversa não encontrada." };
  }

  // Gravar mensagem preliminarmente com status PENDING (Garantia de persistência prévia)
  const [createdMsg] = await db
    .insert(messages)
    .values({
      organizationId,
      conversationId,
      direction: "OUTBOUND",
      content,
      deliveryStatus: "PENDING",
      sentBy,
      ...(sentByUserId ? { sentByUserId } : {}),
    })
    .returning({ id: messages.id });

  if (!createdMsg) {
    return { success: false, error: "Falha ao gravar mensagem preliminar." };
  }

  // Enfileirar na fila durável do pg-boss
  const boss = await getQueue();
  await boss.send(QUEUES.SEND_OUTBOUND, {
    messageId: createdMsg.id,
    conversationId,
    organizationId,
    to,
    content,
    sentBy,
    controlVersion: conv.controlVersion,
  });

  return { success: true, messageId: createdMsg.id };
}

// ─── Processar envio no Worker ───────────────────────────────────────────────

export async function processOutboundMessage(jobData: OutboundJobPayload): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const { messageId, conversationId, organizationId, to, content, sentBy, controlVersion } =
    jobData;

  // 1. Verificação Atômica Pré-Envio (D-004 e D-005: intervenção humana vence a IA)
  const [currentConv] = await db
    .select({
      status: conversations.status,
      controlVersion: conversations.controlVersion,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);

  if (!currentConv) {
    await db.update(messages).set({ deliveryStatus: "FAILED" }).where(eq(messages.id, messageId));
    return { sent: false, reason: "Conversa inexistente no momento do envio" };
  }

  // Se o envio é da IA, mas o controlVersion mudou ou status é HUMAN_ACTIVE, aborta!
  if (sentBy === "ai") {
    if (currentConv.controlVersion !== controlVersion || currentConv.status === "HUMAN_ACTIVE") {
      await db.update(messages).set({ deliveryStatus: "FAILED" }).where(eq(messages.id, messageId));
      return {
        sent: false,
        reason: "Envio cancelado: intervenção humana detectada (control_version alterado)",
      };
    }
  }

  // 2. Buscar sessão WAHA da organização
  const [org] = await db
    .select({ wahaSession: organizations.wahaSession })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const session = org?.wahaSession ?? "default";

  // 3. Disparar via WAHA HTTP API
  try {
    const wahaMessageId = await sendTextMessage(to, content, session);

    // 4. Atualizar mensagem com ID do WAHA e status SENT
    await db
      .update(messages)
      .set({
        wahaMessageId,
        deliveryStatus: "SENT",
      })
      .where(eq(messages.id, messageId));

    return { sent: true };
  } catch (err) {
    await db.update(messages).set({ deliveryStatus: "FAILED" }).where(eq(messages.id, messageId));
    return { sent: false, reason: (err as Error).message };
  }
}
