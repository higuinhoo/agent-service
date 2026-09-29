import { z } from "zod";

const WAHA_BASE_URL = process.env["WAHA_BASE_URL"] ?? "http://localhost:3001";
const WAHA_API_KEY = process.env["WAHA_API_KEY"] ?? "";
const WAHA_SESSION = process.env["WAHA_SESSION"] ?? "default";

// ─── Schema de resposta de envio ──────────────────────────────────────────────

const sendMessageResponseSchema = z.object({
  id: z.string(),
  timestamp: z.number().optional(),
});

// ─── Cliente WAHA ─────────────────────────────────────────────────────────────

async function wahaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${WAHA_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": WAHA_API_KEY,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(empty)");
    throw new Error(`WAHA ${options.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Verificar HMAC do webhook ────────────────────────────────────────────────

export async function verifyWahaHmac(body: string, signature: string): Promise<boolean> {
  const secret = process.env["WAHA_WEBHOOK_HMAC_SECRET"];
  if (!secret) return true; // dev sem HMAC configurado

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Buffer.from(mac).toString("hex");
  return expected === signature;
}

// ─── Gerenciamento de Sessões ────────────────────────────────────────────────

export async function startSession(session = WAHA_SESSION): Promise<{ status: string }> {
  return wahaFetch<{ status: string }>(`/api/sessions/${session}/start`, {
    method: "POST",
  });
}

export async function stopSession(session = WAHA_SESSION): Promise<{ status: string }> {
  return wahaFetch<{ status: string }>(`/api/sessions/${session}/stop`, {
    method: "POST",
  });
}

export async function getSessionStatus(session = WAHA_SESSION): Promise<string> {
  try {
    const res = await wahaFetch<{ status: string }>(`/api/sessions/${session}`);
    return res.status;
  } catch {
    return "STOPPED";
  }
}

export async function getQRCode(session = WAHA_SESSION): Promise<string | null> {
  try {
    const res = await wahaFetch<{ qr?: string; raw?: string }>(`/api/${session}/auth/qr`);
    return res.raw ?? res.qr ?? null;
  } catch {
    return null;
  }
}

// ─── Envio de Mensagem ────────────────────────────────────────────────────────

export async function sendTextMessage(
  to: string,
  text: string,
  session = WAHA_SESSION,
): Promise<string> {
  // Limpar telefone mantendo apenas números
  const cleanPhone = to.replace(/\D/g, "");
  const chatId = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

  const res = await wahaFetch<z.infer<typeof sendMessageResponseSchema>>(`/api/sendText`, {
    method: "POST",
    body: JSON.stringify({ session, chatId, text }),
  });
  const parsed = sendMessageResponseSchema.parse(res);
  return parsed.id;
}
