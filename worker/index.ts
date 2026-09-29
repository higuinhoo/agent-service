import { getQueue, QUEUES } from "@/lib/queue";
import type PgBoss from "pg-boss";
import { processOutboundMessage, type OutboundJobPayload } from "@/lib/waha/outbox";
import { executeAgentTurn } from "@/lib/ai/runtime";
import { expireAllBookingHolds } from "@/lib/scheduling";

// ─── Payload types ────────────────────────────────────────────────────────────

interface InboundMessageJob {
  messageId: string;
  conversationId: string;
  organizationId: string;
  from: string;
  body: string;
  session: string;
}

// ─── Handler: processar mensagem recebida (INBOUND) ───────────────────────────

async function handleInboundMessage(jobs: PgBoss.Job<InboundMessageJob>[]): Promise<void> {
  for (const job of jobs) {
    const { conversationId, organizationId, from, body, session } = job.data;
    console.info(
      `[worker] process-inbound: conv=${conversationId} from=${from} session=${session}`,
    );

    try {
      // Disparar turno do agente IA
      const result = await executeAgentTurn({
        conversationId,
        organizationId,
        incomingMessage: body,
      });

      if (result.completed) {
        console.info(`[worker] agent completed turn for conv=${conversationId}`);
      } else if (result.aborted) {
        console.warn(`[worker] agent aborted turn for conv=${conversationId}: ${result.reason}`);
      } else {
        console.info(`[worker] agent did not reply: ${result.reason}`);
      }
    } catch (err) {
      console.error(`[worker] agent error for conv=${conversationId}:`, err);
    }
  }
}

// ─── Handler: envio assíncrono de mensagens (OUTBOUND / Outbox) ───────────────

async function handleSendOutbound(jobs: PgBoss.Job<OutboundJobPayload>[]): Promise<void> {
  for (const job of jobs) {
    const result = await processOutboundMessage(job.data);
    if (result.sent) {
      console.info(`[worker] send-outbound success: msgId=${job.data.messageId}`);
    } else {
      console.warn(
        `[worker] send-outbound failed/cancelled: msgId=${job.data.messageId} reason=${result.reason}`,
      );
    }
  }
}

async function handleExpireBookingHolds(): Promise<void> {
  const expired = await expireAllBookingHolds();
  if (expired.length > 0) console.info(`[worker] expired booking holds: count=${expired.length}`);
}

// ─── Bootstrap do worker ──────────────────────────────────────────────────────

async function startWorker(): Promise<void> {
  console.info("[worker] starting...");
  const boss = await getQueue();

  await boss.work<InboundMessageJob>(QUEUES.PROCESS_INBOUND, handleInboundMessage);
  await boss.work<OutboundJobPayload>(QUEUES.SEND_OUTBOUND, handleSendOutbound);
  await boss.work(QUEUES.EXPIRE_BOOKING_HOLDS, handleExpireBookingHolds);
  await boss.schedule(QUEUES.EXPIRE_BOOKING_HOLDS, "* * * * *");
  await handleExpireBookingHolds();

  console.info(
    "[worker] listening on queues:",
    QUEUES.PROCESS_INBOUND,
    QUEUES.SEND_OUTBOUND,
    QUEUES.EXPIRE_BOOKING_HOLDS,
  );

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.info("[worker] shutting down...");
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

startWorker().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
