import { type NextRequest, NextResponse } from "next/server";
import { verifyWahaHmac } from "@/lib/waha/client";
import { handleWahaWebhook, type WahaWebhookPayload } from "@/lib/waha/webhook-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  // 1. Validar HMAC usando o corpo bruto (Invariante waha-integration)
  const isValid = await verifyWahaHmac(rawBody, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Assinatura HMAC inválida" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Payload JSON malformado" }, { status: 400 });
  }

  const payload = parsed as WahaWebhookPayload;
  if (!payload || !payload.event || !payload.session) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // 2. Persistir e processar assincronamente via handler
  await handleWahaWebhook(payload);

  // 3. Responder rapidamente 200 OK para o WAHA
  return NextResponse.json({ ok: true });
}
