import PgBoss from "pg-boss";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required for queue");
}

// Guardamos como string não-nullable após a validação acima
const connectionString: string = DATABASE_URL;

let _boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (_boss) return _boss;

  _boss = new PgBoss({
    connectionString,
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 300,
    deleteAfterDays: 7,
    monitorStateIntervalSeconds: 60,
  });

  await _boss.start();
  console.info("[queue] pg-boss started");

  _boss.on("error", (err) => {
    console.error("[queue] pg-boss error:", err);
  });

  return _boss;
}

// ─── Nomes de filas (centralizado para evitar typos) ──────────────────────────

export const QUEUES = {
  PROCESS_INBOUND: "process-inbound-message",
  SEND_OUTBOUND: "send-outbound-message",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
