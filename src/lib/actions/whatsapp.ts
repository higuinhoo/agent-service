"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateOrgWahaSession, getOrganizationById, getConversationById } from "@/lib/db/queries";
import { startSession, stopSession, getSessionStatus, getQRCode } from "@/lib/waha/client";
import { enqueueOutboundMessage } from "@/lib/waha/outbox";
import { db } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema/index";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";

export interface WhatsappActionResult {
  error?: string;
  success?: boolean;
}

export async function saveWahaSessionAction(formData: FormData): Promise<WhatsappActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userRole = (session.user as { role: string }).role;
  if (userRole !== "admin") return { error: "Sem permissão." };

  const sessionName = formData.get("sessionName")?.toString().trim();
  if (!sessionName) return { error: "Nome de sessão inválido." };

  await updateOrgWahaSession(orgId, sessionName);

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "whatsapp.session_updated",
    resourceType: "organization",
    resourceId: orgId,
    metadata: { sessionName },
  });

  return { success: true };
}

export async function startWahaSessionAction(): Promise<WhatsappActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const org = await getOrganizationById(orgId);
  const sessionName = org?.wahaSession || "default";

  try {
    await startSession(sessionName);
    return { success: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function stopWahaSessionAction(): Promise<WhatsappActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const org = await getOrganizationById(orgId);
  const sessionName = org?.wahaSession || "default";

  try {
    await stopSession(sessionName);
    return { success: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function getWahaSessionInfoAction(): Promise<{
  status: string;
  qrCode: string | null;
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const org = await getOrganizationById(orgId);
  const sessionName = org?.wahaSession || "default";

  const status = await getSessionStatus(sessionName);
  let qrCode: string | null = null;
  if (status === "SCAN_QR_CODE") {
    qrCode = await getQRCode(sessionName);
  }

  return { status, qrCode };
}

export async function sendManualReplyAction(
  conversationId: string,
  text: string,
): Promise<WhatsappActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userId = session.user.id ?? undefined;

  const conv = await getConversationById(conversationId, orgId);
  if (!conv) return { error: "Conversa não encontrada." };

  const cleanText = text.trim();
  if (!cleanText) return { error: "Mensagem vazia." };

  // Ao enviar resposta manual pelo dashboard, conversa muda para HUMAN_ACTIVE e incrementa controlVersion (D-004)
  const nextControlVersion = (parseInt(conv.controlVersion, 10) + 1).toString();
  await db
    .update(conversations)
    .set({
      status: "HUMAN_ACTIVE",
      controlVersion: nextControlVersion,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  const result = await enqueueOutboundMessage({
    organizationId: orgId,
    conversationId,
    to: conv.contactPhone,
    content: cleanText,
    sentBy: "agent",
    ...(userId ? { sentByUserId: userId } : {}),
  });

  if (!result.success) {
    return { error: result.error ?? "Falha ao enviar mensagem." };
  }

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "message.manual_sent",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { to: conv.contactPhone },
  });

  return { success: true };
}
