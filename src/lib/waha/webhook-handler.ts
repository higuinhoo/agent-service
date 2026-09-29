import { db } from "@/lib/db/client";
import {
  organizations,
  contacts,
  conversations,
  messages,
  webhookEvents,
} from "@/lib/db/schema/index";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { getQueue, QUEUES } from "@/lib/queue";

export interface WahaWebhookPayload {
  event: string;
  session: string;
  payload: {
    id: string;
    from?: string;
    to?: string;
    body?: string;
    fromMe?: boolean;
    source?: string;
    ack?: number;
    status?: string;
  };
}

export async function handleWahaWebhook(eventData: WahaWebhookPayload): Promise<{
  processed: boolean;
  reason?: string;
}> {
  const { event, session, payload } = eventData;

  // 1. Resolver organização confiavelmente pelo session (Invariante waha-integration)
  const [org] = await db
    .select({
      id: organizations.id,
      suspended: organizations.suspended,
    })
    .from(organizations)
    .where(eq(organizations.wahaSession, session))
    .limit(1);

  if (!org || org.suspended) {
    return { processed: false, reason: "Organização não encontrada ou suspensa para esta sessão" };
  }

  // 2. Deduplicação em nível de evento no banco de dados (Idempotência)
  const ackSuffix = payload.ack !== undefined ? `:${payload.ack}` : "";
  const eventKey = `${session}:${payload.id || event}:${event}${ackSuffix}`;

  try {
    const [insertedEvent] = await db
      .insert(webhookEvents)
      .values({
        eventId: eventKey,
        event,
        session,
        payload: payload as Record<string, unknown>,
        processed: false,
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (!insertedEvent) {
      // Evento duplicado já recebido anteriormente
      return { processed: false, reason: "Evento duplicado descartado" };
    }
  } catch {
    // Falha ao gravar idempotência, seguir com cautela
  }

  // 3. Tratar evento de mensagem
  if (event === "message" || event === "message.any") {
    const wahaMessageId = payload.id;
    const fromMe = Boolean(payload.fromMe);
    const source = payload.source ?? "app";
    const body = payload.body ?? "";

    // ─── Cenário A: fromMe=true + source=app → Intervenção Humana (D-004) ───
    if (fromMe && source === "app") {
      const recipientPhone = (payload.to ?? "").replace(/\D/g, "");
      if (!recipientPhone) return { processed: true };

      // Localizar contato e conversa
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, org.id), eq(contacts.phone, recipientPhone)))
        .limit(1);

      if (contact) {
        const [conversation] = await db
          .select()
          .from(conversations)
          .where(
            and(eq(conversations.organizationId, org.id), eq(conversations.contactId, contact.id)),
          )
          .limit(1);

        if (conversation) {
          const nextControlVersion = (parseInt(conversation.controlVersion, 10) + 1).toString();

          // Intervenção humana: muda conversa para HUMAN_ACTIVE e incrementa control_version
          await db
            .update(conversations)
            .set({
              status: "HUMAN_ACTIVE",
              controlVersion: nextControlVersion,
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversation.id));

          // Gravar mensagem do atendente
          await db
            .insert(messages)
            .values({
              organizationId: org.id,
              conversationId: conversation.id,
              wahaMessageId,
              direction: "OUTBOUND",
              content: body,
              deliveryStatus: "SENT",
              sentBy: "agent",
            })
            .onConflictDoNothing();

          await writeAuditLog({
            organizationId: org.id,
            actorId: null,
            actorEmail: "whatsapp@app",
            action: "conversation.human_takeover",
            resourceType: "conversation",
            resourceId: conversation.id,
            metadata: {
              controlVersion: nextControlVersion,
              phone: recipientPhone,
            },
          });
        }
      }

      return { processed: true };
    }

    // ─── Cenário B: fromMe=true + source=api → Eco da nossa própria mensagem ──
    if (fromMe && source === "api") {
      if (wahaMessageId) {
        await db
          .update(messages)
          .set({ deliveryStatus: "SENT" })
          .where(eq(messages.wahaMessageId, wahaMessageId));
      }
      return { processed: true };
    }

    // ─── Cenário C: fromMe=false → Mensagem recebida do cliente (INBOUND) ───
    if (!fromMe) {
      const senderPhone = (payload.from ?? "").replace(/\D/g, "");
      if (!senderPhone) return { processed: true };

      // Localizar ou criar contato
      let [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, org.id), eq(contacts.phone, senderPhone)))
        .limit(1);

      if (!contact) {
        const [createdContact] = await db
          .insert(contacts)
          .values({
            organizationId: org.id,
            name: `WhatsApp ${senderPhone.slice(-4)}`,
            phone: senderPhone,
          })
          .returning();
        contact = createdContact;
      }

      if (!contact) return { processed: false, reason: "Falha ao resolver contato" };

      // Localizar ou criar conversa
      let [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.organizationId, org.id), eq(conversations.contactId, contact.id)),
        )
        .limit(1);

      if (!conversation) {
        const [createdConv] = await db
          .insert(conversations)
          .values({
            organizationId: org.id,
            contactId: contact.id,
            status: "OPEN",
            controlVersion: "1",
            wahaSessionId: session,
            lastMessageAt: new Date(),
          })
          .returning();
        conversation = createdConv;
      } else {
        await db
          .update(conversations)
          .set({
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversation.id));
      }

      if (!conversation) return { processed: false, reason: "Falha ao resolver conversa" };

      // Persistir mensagem recebida com idempotência
      const [insertedMessage] = await db
        .insert(messages)
        .values({
          organizationId: org.id,
          conversationId: conversation.id,
          wahaMessageId,
          direction: "INBOUND",
          content: body,
          deliveryStatus: "DELIVERED",
          sentBy: "contact",
        })
        .onConflictDoNothing()
        .returning();

      if (insertedMessage) {
        // Enfileirar para processamento assíncrono
        const boss = await getQueue();
        await boss.send(QUEUES.PROCESS_INBOUND, {
          messageId: insertedMessage.id,
          conversationId: conversation.id,
          organizationId: org.id,
          from: senderPhone,
          body,
          session,
        });
      }

      return { processed: true };
    }
  }

  // 4. Tratar evento de confirmação de entrega / leitura (message.ack)
  if (event === "message.ack") {
    const wahaMessageId = payload.id;
    const ack = payload.ack ?? 1;

    let deliveryStatus: "SENT" | "DELIVERED" | "READ" = "SENT";
    if (ack >= 3) {
      deliveryStatus = "READ";
    } else if (ack >= 2) {
      deliveryStatus = "DELIVERED";
    }

    if (wahaMessageId) {
      await db
        .update(messages)
        .set({
          deliveryStatus,
          ack: ack.toString(),
        })
        .where(eq(messages.wahaMessageId, wahaMessageId));
    }

    return { processed: true };
  }

  return { processed: true };
}
