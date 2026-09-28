import { getQueue, QUEUES } from "@/lib/queue";
import type PgBoss from "pg-boss";

// ─── Payload types ────────────────────────────────────────────────────────────

interface InboundMessageJob {
  wahaMessageId: string;
  from: string;
  body: string;
  session: string;
}

// ─── Handler: processar mensagem recebida ──────────────────────────────────────

async function handleInboundMessage(jobs: PgBoss.Job<InboundMessageJob>[]): Promise<void> {
  for (const job of jobs) {
    const { wahaMessageId, from, body, session } = job.data;
    console.info(`[worker] inbound ${wahaMessageId} from=${from} session=${session}`);

    // TODO T-004: lookup contact, conversation, controle IA/humano, invocar adapter AI
    console.info(`[worker] body: ${body.slice(0, 80)}`);
  }
}

// ─── Bootstrap do worker ──────────────────────────────────────────────────────

async function startWorker(): Promise<void> {
  console.info("[worker] starting...");
  const boss = await getQueue();

  await boss.work<InboundMessageJob>(QUEUES.PROCESS_INBOUND, handleInboundMessage);

  console.info("[worker] listening on queue:", QUEUES.PROCESS_INBOUND);

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
