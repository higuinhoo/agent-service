CREATE TYPE "public"."agent_run_status" AS ENUM('RUNNING', 'COMPLETED', 'ABORTED_HUMAN_INTERVENTION', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."availability_exception_kind" AS ENUM('BLOCKED', 'AVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."booking_hold_status" AS ENUM('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('OPEN', 'AI_ACTIVE', 'HUMAN_ACTIVE', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."message_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'agent', 'supervisor');--> statement-breakpoint
CREATE TABLE "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text DEFAULT 'Atendente Virtual IA' NOT NULL,
	"system_prompt" text DEFAULT 'Você é um assistente virtual atencioso e eficiente. Seu objetivo é tirar dúvidas sobre a empresa, listar serviços e oferecer agendamentos.' NOT NULL,
	"company_info" text DEFAULT 'Horário de funcionamento: Seg-Sex das 8h às 18h.' NOT NULL,
	"model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" text DEFAULT '0.7' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_configs_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"control_version_captured" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'RUNNING' NOT NULL,
	"tokens_prompt" text,
	"tokens_completion" text,
	"execution_time_ms" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"kind" "availability_exception_kind" DEFAULT 'BLOCKED' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"contact_id" uuid,
	"idempotency_key" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "booking_hold_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"contact_id" uuid,
	"hold_id" uuid,
	"idempotency_key" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'CONFIRMED' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"assigned_to_id" uuid,
	"status" "conversation_status" DEFAULT 'OPEN' NOT NULL,
	"control_version" text DEFAULT '0' NOT NULL,
	"waha_session_id" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"waha_message_id" text,
	"direction" text NOT NULL,
	"content" text NOT NULL,
	"delivery_status" "message_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"ack" text,
	"sent_by" text NOT NULL,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_waha_message_id_unique" UNIQUE("waha_message_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"waha_session" text,
	"suspended" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resource_services" (
	"organization_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "resource_services_resource_id_service_id_pk" PRIMARY KEY("resource_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event" text NOT NULL,
	"session" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hold_id_booking_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."booking_holds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_services" ADD CONSTRAINT "resource_services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_services" ADD CONSTRAINT "resource_services_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_services" ADD CONSTRAINT "resource_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exceptions_org_resource_start_idx" ON "availability_exceptions" USING btree ("organization_id","resource_id","starts_at");--> statement-breakpoint
CREATE INDEX "availability_rules_org_resource_idx" ON "availability_rules" USING btree ("organization_id","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_holds_org_idempotency_unique" ON "booking_holds" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "booking_holds_org_resource_start_idx" ON "booking_holds" USING btree ("organization_id","resource_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_holds_active_expiry_idx" ON "booking_holds" USING btree ("organization_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_idempotency_unique" ON "bookings" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bookings_org_resource_start_idx" ON "bookings" USING btree ("organization_id","resource_id","starts_at");--> statement-breakpoint
CREATE INDEX "resource_services_org_idx" ON "resource_services" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_org_name_unique" ON "resources" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "resources_org_active_idx" ON "resources" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "services_org_name_unique" ON "services" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "services_org_active_idx" ON "services" USING btree ("organization_id","is_active");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive" CHECK ("duration_minutes" BETWEEN 1 AND 1440);
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_weekday_valid" CHECK ("weekday" BETWEEN 0 AND 6);
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_time_valid" CHECK ("start_time" < "end_time");
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_period_valid" CHECK ("starts_at" < "ends_at");
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_period_valid" CHECK ("starts_at" < "ends_at");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_period_valid" CHECK ("starts_at" < "ends_at");
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_unique" UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_unique" UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_unique" UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_org_id_unique" UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "resource_services" ADD CONSTRAINT "resource_services_tenant_resource_fk" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "resources"("organization_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "resource_services" ADD CONSTRAINT "resource_services_tenant_service_fk" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_tenant_resource_fk" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "resources"("organization_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_tenant_resource_fk" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "resources"("organization_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_tenant_resource_fk" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "resources"("organization_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_tenant_service_fk" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_tenant_contact_fk" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE SET NULL ("contact_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_resource_fk" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "resources"("organization_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_service_fk" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_contact_fk" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE SET NULL ("contact_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_hold_fk" FOREIGN KEY ("organization_id", "hold_id") REFERENCES "booking_holds"("organization_id", "id") ON DELETE SET NULL ("hold_id");
--> statement-breakpoint
ALTER TABLE "booking_holds" ADD CONSTRAINT "booking_holds_no_overlap" EXCLUDE USING gist (
  "organization_id" WITH =,
  "resource_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" = 'ACTIVE');
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
  "organization_id" WITH =,
  "resource_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" = 'CONFIRMED');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_schedule_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_TABLE_NAME = 'booking_holds' AND NEW.status <> 'ACTIVE')
     OR (TG_TABLE_NAME = 'bookings' AND NEW.status <> 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.organization_id::text || ':' || NEW.resource_id::text, 0)
  );

  UPDATE booking_holds
  SET status = 'EXPIRED', updated_at = now()
  WHERE organization_id = NEW.organization_id
    AND resource_id = NEW.resource_id
    AND status = 'ACTIVE'
    AND expires_at <= now()
    AND id <> NEW.id;

  IF EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.organization_id = NEW.organization_id
      AND b.resource_id = NEW.resource_id
      AND b.status = 'CONFIRMED'
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
      AND (TG_TABLE_NAME <> 'bookings' OR b.id <> NEW.id)
  ) OR EXISTS (
    SELECT 1
    FROM booking_holds h
    WHERE h.organization_id = NEW.organization_id
      AND h.resource_id = NEW.resource_id
      AND h.status = 'ACTIVE'
      AND h.expires_at > now()
      AND tstzrange(h.starts_at, h.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
      AND (TG_TABLE_NAME <> 'booking_holds' OR h.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'schedule slot overlaps an active reservation' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER booking_holds_prevent_overlap
BEFORE INSERT OR UPDATE OF "organization_id", "resource_id", "starts_at", "ends_at", "expires_at", "status"
ON "booking_holds"
FOR EACH ROW EXECUTE FUNCTION enforce_schedule_no_overlap();
--> statement-breakpoint
CREATE TRIGGER bookings_prevent_overlap
BEFORE INSERT OR UPDATE OF "organization_id", "resource_id", "starts_at", "ends_at", "status"
ON "bookings"
FOR EACH ROW EXECUTE FUNCTION enforce_schedule_no_overlap();
