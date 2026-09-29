import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  pgEnum,
  jsonb,
  integer,
  time,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
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
export const availabilityExceptionKindEnum = pgEnum("availability_exception_kind", [
  "BLOCKED",
  "AVAILABLE",
]);
export const bookingHoldStatusEnum = pgEnum("booking_hold_status", [
  "ACTIVE",
  "CONSUMED",
  "RELEASED",
  "EXPIRED",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);

// ─── Organizations (tenants) ──────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
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

// ─── Scheduling (Fase 4: agenda local) ──────────────────────────────────────

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("services_org_name_unique").on(table.organizationId, table.name),
    index("services_org_active_idx").on(table.organizationId, table.isActive),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("resources_org_name_unique").on(table.organizationId, table.name),
    index("resources_org_active_idx").on(table.organizationId, table.isActive),
  ],
);

export const resourceServices = pgTable(
  "resource_services",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.serviceId] }),
    index("resource_services_org_idx").on(table.organizationId),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("availability_rules_org_resource_idx").on(table.organizationId, table.resourceId),
  ],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    kind: availabilityExceptionKindEnum("kind").notNull().default("BLOCKED"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("availability_exceptions_org_resource_start_idx").on(
      table.organizationId,
      table.resourceId,
      table.startsAt,
    ),
  ],
);

export const bookingHolds = pgTable(
  "booking_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: bookingHoldStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_holds_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("booking_holds_org_resource_start_idx").on(
      table.organizationId,
      table.resourceId,
      table.startsAt,
    ),
    index("booking_holds_active_expiry_idx").on(
      table.organizationId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    holdId: uuid("hold_id").references(() => bookingHolds.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatusEnum("status").notNull().default("CONFIRMED"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bookings_org_idempotency_unique").on(table.organizationId, table.idempotencyKey),
    index("bookings_org_resource_start_idx").on(
      table.organizationId,
      table.resourceId,
      table.startsAt,
    ),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const organizationRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  contacts: many(contacts),
  conversations: many(conversations),
  auditLogs: many(auditLogs),
  services: many(services),
  resources: many(resources),
  availabilityRules: many(availabilityRules),
  availabilityExceptions: many(availabilityExceptions),
  bookingHolds: many(bookingHolds),
  bookings: many(bookings),
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

export const serviceRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.organizationId],
    references: [organizations.id],
  }),
  resourceServices: many(resourceServices),
  holds: many(bookingHolds),
  bookings: many(bookings),
}));

export const resourceRelations = relations(resources, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [resources.organizationId],
    references: [organizations.id],
  }),
  resourceServices: many(resourceServices),
  availabilityRules: many(availabilityRules),
  availabilityExceptions: many(availabilityExceptions),
  holds: many(bookingHolds),
  bookings: many(bookings),
}));

export const resourceServiceRelations = relations(resourceServices, ({ one }) => ({
  organization: one(organizations, {
    fields: [resourceServices.organizationId],
    references: [organizations.id],
  }),
  resource: one(resources, {
    fields: [resourceServices.resourceId],
    references: [resources.id],
  }),
  service: one(services, {
    fields: [resourceServices.serviceId],
    references: [services.id],
  }),
}));

export const availabilityRuleRelations = relations(availabilityRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [availabilityRules.organizationId],
    references: [organizations.id],
  }),
  resource: one(resources, {
    fields: [availabilityRules.resourceId],
    references: [resources.id],
  }),
}));

export const availabilityExceptionRelations = relations(availabilityExceptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [availabilityExceptions.organizationId],
    references: [organizations.id],
  }),
  resource: one(resources, {
    fields: [availabilityExceptions.resourceId],
    references: [resources.id],
  }),
}));

export const bookingHoldRelations = relations(bookingHolds, ({ one }) => ({
  organization: one(organizations, {
    fields: [bookingHolds.organizationId],
    references: [organizations.id],
  }),
  resource: one(resources, { fields: [bookingHolds.resourceId], references: [resources.id] }),
  service: one(services, { fields: [bookingHolds.serviceId], references: [services.id] }),
  contact: one(contacts, { fields: [bookingHolds.contactId], references: [contacts.id] }),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  resource: one(resources, { fields: [bookings.resourceId], references: [resources.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  contact: one(contacts, { fields: [bookings.contactId], references: [contacts.id] }),
  hold: one(bookingHolds, { fields: [bookings.holdId], references: [bookingHolds.id] }),
}));
