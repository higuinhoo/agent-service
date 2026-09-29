CREATE TYPE "public"."calendar_sync_status" AS ENUM('CONNECTED', 'SYNC_ERROR', 'DISCONNECTED');--> statement-breakpoint
CREATE TYPE "public"."external_calendar_event_status" AS ENUM('SYNCED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"resource_id" uuid,
	"provider" text DEFAULT 'google' NOT NULL,
	"account_email" text NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"calendar_name" text DEFAULT 'Principal' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"sync_status" "calendar_sync_status" DEFAULT 'CONNECTED' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"status" "external_calendar_event_status" DEFAULT 'SYNCED' NOT NULL,
	"etag" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_org_resource_unique" ON "calendar_connections" USING btree ("organization_id","resource_id");--> statement-breakpoint
CREATE INDEX "calendar_connections_org_idx" ON "calendar_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_calendar_events_booking_unique" ON "external_calendar_events" USING btree ("organization_id","booking_id");--> statement-breakpoint
CREATE INDEX "external_calendar_events_conn_idx" ON "external_calendar_events" USING btree ("connection_id","external_event_id");