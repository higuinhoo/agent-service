import { getQueue, QUEUES } from "@/lib/queue";
import type PgBoss from "pg-boss";
import { processOutboundMessage, type OutboundJobPayload } from "@/lib/waha/outbox";

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
    const { conversationId, from, body, session } = job.data;
    console.info(
      `[worker] process-inbound: conv=${conversationId} from=${from} session=${session}`,
    );
    console.info(`[worker] message: ${body.slice(0, 80)}`);
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

// ─── Bootstrap do worker ──────────────────────────────────────────────────────

async function startWorker(): Promise<void> {
  console.info("[worker] starting...");
  const boss = await getQueue();

  await boss.work<InboundMessageJob>(QUEUES.PROCESS_INBOUND, handleInboundMessage);
  await boss.work<OutboundJobPayload>(QUEUES.SEND_OUTBOUND, handleSendOutbound);

  console.info("[worker] listening on queues:", QUEUES.PROCESS_INBOUND, QUEUES.SEND_OUTBOUND);

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
