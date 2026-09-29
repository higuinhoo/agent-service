import { pgTable, text, timestamp, uuid, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "supervisor"]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "OPEN",
  "AI_ACTIVE",
  "HUMAN_ACTIVE",
  "CLOSED",
]);
export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", [
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
]);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "RUNNING",
  "COMPLETED",
  "ABORTED_HUMAN_INTERVENTION",
  "FAILED",
]);

// ─── Organizations (tenants) ──────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  wahaSession: text("waha_session"),
  suspended: boolean("suspended").notNull().default(false),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("agent"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  assignedToId: uuid("assigned_to_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: conversationStatusEnum("status").notNull().default("OPEN"),
  controlVersion: text("control_version").notNull().default("0"),
  wahaSessionId: text("waha_session_id"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  wahaMessageId: text("waha_message_id").unique(),
  direction: text("direction", { enum: ["INBOUND", "OUTBOUND"] }).notNull(),
  content: text("content").notNull(),
  deliveryStatus: messageDeliveryStatusEnum("delivery_status").notNull().default("PENDING"),
  ack: text("ack"),
  sentBy: text("sent_by", {
    enum: ["contact", "agent", "ai", "system"],
  }).notNull(),
  sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Agent Configs (Fase 3: Configuração do Agente IA por Tenant) ─────────────

export const agentConfigs = pgTable("agent_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Atendente Virtual IA"),
  systemPrompt: text("system_prompt")
    .notNull()
    .default(
      "Você é um assistente virtual atencioso e eficiente. Seu objetivo é tirar dúvidas sobre a empresa, listar serviços e oferecer agendamentos.",
    ),
  companyInfo: text("company_info")
    .notNull()
    .default("Horário de funcionamento: Seg-Sex das 8h às 18h."),
  model: text("model").notNull().default("gpt-4o-mini"),
  temperature: text("temperature").notNull().default("0.7"),
  isActive: boolean("is_active").notNull().default(true),
  version: text("version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Agent Runs (Fase 3: Observabilidade dos Turnos do Agente) ────────────────

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  controlVersionCaptured: text("control_version_captured").notNull(),
  status: agentRunStatusEnum("status").notNull().default("RUNNING"),
  tokensPrompt: text("tokens_prompt"),
  tokensCompletion: text("tokens_completion"),
  executionTimeMs: text("execution_time_ms"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Tool Calls (Fase 3: Auditoria de Ferramentas Invocadas) ──────────────────

export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Webhook Events (Idempotência e Auditoria de Webhooks) ─────────────────────

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").unique().notNull(),
  event: text("event").notNull(),
  session: text("session").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const organizationRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  contacts: many(contacts),
  conversations: many(conversations),
  auditLogs: many(auditLogs),
  agentConfig: one(agentConfigs, {
    fields: [organizations.id],
    references: [agentConfigs.organizationId],
  }),
}));

export const userRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const contactRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
}));

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  assignedTo: one(users, {
    fields: [conversations.assignedToId],
    references: [users.id],
  }),
  messages: many(messages),
  agentRuns: many(agentRuns),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  organization: one(organizations, {
    fields: [messages.organizationId],
    references: [organizations.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sentByUser: one(users, {
    fields: [messages.sentByUserId],
    references: [users.id],
  }),
}));

export const agentConfigRelations = relations(agentConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [agentConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export const agentRunRelations = relations(agentRuns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agentRuns.organizationId],
    references: [organizations.id],
  }),
  conversation: one(conversations, {
    fields: [agentRuns.conversationId],
    references: [conversations.id],
  }),
  toolCalls: many(toolCalls),
}));

export const toolCallRelations = relations(toolCalls, ({ one }) => ({
  run: one(agentRuns, {
    fields: [toolCalls.runId],
    references: [agentRuns.id],
  }),
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));
