import { type NextRequest, NextResponse } from "next/server";
import { verifyWahaHmac } from "@/lib/waha/client";
import { getQueue, QUEUES } from "@/lib/queue";
import { z } from "zod";

// Schema mínimo do payload WAHA — validação defensiva
const wahaEventSchema = z.object({
  event: z.string(),
  session: z.string(),
  payload: z.object({
    id: z.string(),
    from: z.string(),
    body: z.string().optional(),
    type: z.string(),
    source: z.string().optional(),
  }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  // Verificar HMAC antes de processar
  const isValid = await verifyWahaHmac(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = wahaEventSchema.safeParse(parsed);
  if (!result.success) {
    // Evento desconhecido — aceitar sem processar (WAHA envia vários eventos)
    return NextResponse.json({ ok: true });
  }

  const { event, payload } = result.data;

  // Processar apenas mensagens recebidas de contatos (não de app — D-010)
  if (event === "message" && payload.source !== "app") {
    const boss = await getQueue();
    await boss.send(QUEUES.PROCESS_INBOUND, {
      wahaMessageId: payload.id,
      from: payload.from,
      body: payload.body ?? "",
      session: result.data.session,
    });
  }

  return NextResponse.json({ ok: true });
}
