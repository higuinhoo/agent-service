import { db } from "@/lib/db/client";
import {
  users,
  contacts,
  conversations,
  messages,
  organizations,
  auditLogs,
  agentConfigs,
  agentRuns,
  toolCalls,
  services,
  resources,
  resourceServices,
  availabilityRules,
  availabilityExceptions,
  bookings,
} from "@/lib/db/schema/index";
import { eq, and, desc, asc, gt, lte } from "drizzle-orm";

// Todas as queries garantem filtro por organizationId — nunca retornam dados de outro tenant

export async function getOrganizationById(organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org;
}

export async function updateOrgWahaSession(organizationId: string, sessionName: string) {
  await db
    .update(organizations)
    .set({
      wahaSession: sessionName,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

export async function getUsersByOrg(organizationId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .orderBy(users.createdAt);
}

export async function getUserByEmail(email: string, organizationId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.organizationId, organizationId)))
    .limit(1);
  return user;
}

export async function getContactsByOrg(organizationId: string) {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, organizationId))
    .orderBy(desc(contacts.createdAt));
}

export async function getContactById(id: string, organizationId: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, organizationId)))
    .limit(1);
  return contact;
}

export async function getConversationsByOrg(organizationId: string) {
  return db
    .select({
      id: conversations.id,
      status: conversations.status,
      controlVersion: conversations.controlVersion,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      contactId: contacts.id,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.organizationId, organizationId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationById(conversationId: string, organizationId: string) {
  const [conv] = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      controlVersion: conversations.controlVersion,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      contactId: contacts.id,
      contactName: contacts.name,
      contactPhone: contacts.phone,
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);
  return conv;
}

export async function setConversationControlMode(
  conversationId: string,
  organizationId: string,
  status: "OPEN" | "AI_ACTIVE" | "HUMAN_ACTIVE" | "CLOSED",
) {
  const [conv] = await db
    .select({ controlVersion: conversations.controlVersion })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    )
    .limit(1);

  if (!conv) return null;

  const nextControlVersion = (parseInt(conv.controlVersion, 10) + 1).toString();

  await db
    .update(conversations)
    .set({
      status,
      controlVersion: nextControlVersion,
      updatedAt: new Date(),
    })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, organizationId)),
    );

  return nextControlVersion;
}

export async function getMessagesByConversation(
  conversationId: string,
  organizationId: string,
  limit = 100,
) {
  return db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), eq(messages.organizationId, organizationId)),
    )
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function getAuditLogsByOrg(organizationId: string, limit = 50) {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ─── Queries do Agente IA ───────────────────────────────────────────────────

export async function getAgentConfigByOrg(organizationId: string) {
  let [config] = await db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.organizationId, organizationId))
    .limit(1);

  if (!config) {
    // Inicialização sob demanda com valores padrão do schema
    const [created] = await db
      .insert(agentConfigs)
      .values({ organizationId })
      .onConflictDoNothing()
      .returning();
    config = created;
  }

  return config;
}

export async function upsertAgentConfig(
  organizationId: string,
  data: {
    name?: string;
    systemPrompt?: string;
    companyInfo?: string;
    temperature?: string;
    isActive?: boolean;
  },
) {
  const [existing] = await db
    .select({ id: agentConfigs.id, version: agentConfigs.version })
    .from(agentConfigs)
    .where(eq(agentConfigs.organizationId, organizationId))
    .limit(1);

  const nextVersion = existing ? (parseInt(existing.version, 10) + 1).toString() : "1";

  if (existing) {
    const [updated] = await db
      .update(agentConfigs)
      .set({
        ...data,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(eq(agentConfigs.organizationId, organizationId))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(agentConfigs)
      .values({
        organizationId,
        ...data,
        version: nextVersion,
      })
      .returning();
    return created;
  }
}

export async function createAgentRun(data: {
  organizationId: string;
  conversationId: string;
  controlVersionCaptured: string;
}) {
  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      controlVersionCaptured: data.controlVersionCaptured,
      status: "RUNNING",
    })
    .returning();
  return run;
}

export async function updateAgentRun(
  runId: string,
  data: {
    status: "COMPLETED" | "ABORTED_HUMAN_INTERVENTION" | "FAILED";
    tokensPrompt?: string;
    tokensCompletion?: string;
    executionTimeMs?: string;
    reason?: string;
  },
) {
  await db.update(agentRuns).set(data).where(eq(agentRuns.id, runId));
}

export async function recordToolCall(data: {
  runId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}) {
  const [tool] = await db
    .insert(toolCalls)
    .values({
      runId: data.runId,
      toolName: data.toolName,
      input: data.input,
      ...(data.output ? { output: data.output } : {}),
    })
    .returning();
  return tool;
}

// ─── Agenda local ────────────────────────────────────────────────────────────

export async function getServicesByOrg(organizationId: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.organizationId, organizationId))
    .orderBy(asc(services.name));
}

export async function getResourcesByOrg(organizationId: string) {
  return db
    .select()
    .from(resources)
    .where(eq(resources.organizationId, organizationId))
    .orderBy(asc(resources.name));
}

export async function getResourceServicesByOrg(organizationId: string) {
  return db
    .select({
      resourceId: resourceServices.resourceId,
      resourceName: resources.name,
      resourceIsActive: resources.isActive,
      serviceId: resourceServices.serviceId,
      serviceName: services.name,
      serviceIsActive: services.isActive,
    })
    .from(resourceServices)
    .innerJoin(
      resources,
      and(
        eq(resourceServices.resourceId, resources.id),
        eq(resourceServices.organizationId, resources.organizationId),
      ),
    )
    .innerJoin(
      services,
      and(
        eq(resourceServices.serviceId, services.id),
        eq(resourceServices.organizationId, services.organizationId),
      ),
    )
    .where(eq(resourceServices.organizationId, organizationId))
    .orderBy(asc(resources.name), asc(services.name));
}

export async function getAvailabilityRulesByOrg(organizationId: string) {
  return db
    .select({
      id: availabilityRules.id,
      resourceId: availabilityRules.resourceId,
      resourceName: resources.name,
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
      isActive: availabilityRules.isActive,
    })
    .from(availabilityRules)
    .innerJoin(
      resources,
      and(
        eq(availabilityRules.resourceId, resources.id),
        eq(availabilityRules.organizationId, resources.organizationId),
      ),
    )
    .where(eq(availabilityRules.organizationId, organizationId))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));
}

export async function getAvailabilityExceptionsByOrg(organizationId: string, from = new Date()) {
  return db
    .select({
      id: availabilityExceptions.id,
      resourceName: resources.name,
      kind: availabilityExceptions.kind,
      startsAt: availabilityExceptions.startsAt,
      endsAt: availabilityExceptions.endsAt,
      reason: availabilityExceptions.reason,
    })
    .from(availabilityExceptions)
    .innerJoin(
      resources,
      and(
        eq(availabilityExceptions.resourceId, resources.id),
        eq(availabilityExceptions.organizationId, resources.organizationId),
      ),
    )
    .where(
      and(
        eq(availabilityExceptions.organizationId, organizationId),
        gt(availabilityExceptions.endsAt, from),
      ),
    )
    .orderBy(asc(availabilityExceptions.startsAt));
}

export async function getBookingsByRange(organizationId: string, from: Date, until: Date) {
  return db
    .select({
      id: bookings.id,
      resourceName: resources.name,
      serviceName: services.name,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(
      resources,
      and(
        eq(bookings.resourceId, resources.id),
        eq(bookings.organizationId, resources.organizationId),
      ),
    )
    .innerJoin(
      services,
      and(
        eq(bookings.serviceId, services.id),
        eq(bookings.organizationId, services.organizationId),
      ),
    )
    .where(
      and(
        eq(bookings.organizationId, organizationId),
        gt(bookings.endsAt, from),
        lte(bookings.startsAt, until),
      ),
    )
    .orderBy(asc(bookings.startsAt));
}
