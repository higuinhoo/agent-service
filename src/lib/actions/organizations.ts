"use server";

import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema/index";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export interface OrgActionResult {
  error?: string;
  success?: boolean;
}

export async function toggleSuspendOrganizationAction(
  targetOrgId: string,
  suspend: boolean,
  reason?: string,
): Promise<OrgActionResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actorRole = (session.user as { role: string }).role;
  if (actorRole !== "admin") {
    return { error: "Apenas administradores podem suspender ou reativar organizações." };
  }

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, targetOrgId))
    .limit(1);

  if (!org) {
    return { error: "Organização não encontrada." };
  }

  await db
    .update(organizations)
    .set({
      suspended: suspend,
      suspendedAt: suspend ? new Date() : null,
      suspendedReason: suspend ? (reason ?? "Suspensão administrativa") : null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, targetOrgId));

  await writeAuditLog({
    organizationId: targetOrgId,
    actorId: session.user.id ?? null,
    actorEmail: session.user.email ?? "",
    action: suspend ? "organization.suspended" : "organization.reactivated",
    resourceType: "organization",
    resourceId: targetOrgId,
    metadata: { reason: reason ?? "N/A" },
  });

  return { success: true };
}
