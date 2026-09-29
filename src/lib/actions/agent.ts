"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setConversationControlMode, upsertAgentConfig } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export interface AgentActionResult {
  error?: string;
  success?: boolean;
}

const updateAgentConfigSchema = z.object({
  name: z.string().min(2).max(100),
  systemPrompt: z.string().min(10).max(4000),
  companyInfo: z.string().min(5).max(4000),
  temperature: z.string().regex(/^0(\.\d+)?|1(\.0+)?$/, "Temperatura deve estar entre 0.0 e 1.0"),
  isActive: z.boolean(),
});

export async function returnConversationToAiAction(
  conversationId: string,
): Promise<AgentActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;

  // D-005: Retorno manual à IA
  const newControlVersion = await setConversationControlMode(conversationId, orgId, "AI_ACTIVE");

  if (!newControlVersion) {
    return { error: "Conversa não encontrada." };
  }

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "conversation.returned_to_ai",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { newControlVersion },
  });

  return { success: true };
}

export async function takeoverConversationAction(
  conversationId: string,
): Promise<AgentActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;

  // D-004: Intervenção humana vence a IA
  const newControlVersion = await setConversationControlMode(conversationId, orgId, "HUMAN_ACTIVE");

  if (!newControlVersion) {
    return { error: "Conversa não encontrada." };
  }

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "conversation.takeover_manual",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { newControlVersion },
  });

  return { success: true };
}

export async function updateAgentConfigAction(formData: FormData): Promise<AgentActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = (session.user as { organizationId: string }).organizationId;
  const userRole = (session.user as { role: string }).role;
  if (userRole !== "admin")
    return { error: "Apenas administradores podem configurar o agente IA." };

  const parsed = updateAgentConfigSchema.safeParse({
    name: formData.get("name"),
    systemPrompt: formData.get("systemPrompt"),
    companyInfo: formData.get("companyInfo"),
    temperature: formData.get("temperature"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }

  const updated = await upsertAgentConfig(orgId, parsed.data);

  await writeAuditLog({
    organizationId: orgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: "agent.config_updated",
    resourceType: "agent_config",
    ...(updated?.id ? { resourceId: updated.id } : {}),
    ...(updated?.version ? { metadata: { version: updated.version } } : {}),
  });

  return { success: true };
}
