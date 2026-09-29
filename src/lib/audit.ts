import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema/index";

interface AuditParams {
  organizationId: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: params.organizationId,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: params.action,
    resourceType: params.resourceType,
    ...(params.resourceId !== undefined ? { resourceId: params.resourceId } : {}),
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
  });
}
