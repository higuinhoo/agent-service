"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db/client";
import {
  availabilityExceptions,
  availabilityRules,
  organizations,
  resourceServices,
  resources,
  services,
} from "@/lib/db/schema";
import { zonedLocalDateTimeToUtc } from "@/lib/scheduling";

export interface SchedulingActionResult {
  error?: string;
  success?: boolean;
}

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
});

const resourceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

const assignmentSchema = z.object({
  resourceId: z.string().uuid(),
  serviceId: z.string().uuid(),
});

const availabilityRuleSchema = z
  .object({
    resourceId: z.string().uuid(),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "O horário final deve ser posterior ao inicial.",
  });

const availabilityExceptionSchema = z.object({
  resourceId: z.string().uuid(),
  kind: z.enum(["BLOCKED", "AVAILABLE"]),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  reason: z.string().trim().max(300).optional(),
});

async function requireSchedulingManager() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as {
    id?: string;
    email?: string | null;
    organizationId: string;
    role: string;
  };
  if (user.role !== "admin" && user.role !== "supervisor") {
    throw new Error("Você não tem permissão para configurar a agenda.");
  }
  return user;
}

export async function createServiceAction(formData: FormData): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };

  const [created] = await db
    .insert(services)
    .values({ organizationId: user.organizationId, ...parsed.data })
    .onConflictDoNothing()
    .returning({ id: services.id });
  if (!created) return { error: "Já existe um serviço com esse nome." };

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "service.created",
    resourceType: "service",
    resourceId: created.id,
    metadata: { name: parsed.data.name, durationMinutes: parsed.data.durationMinutes },
  });
  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function createResourceAction(formData: FormData): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };

  const [created] = await db
    .insert(resources)
    .values({ organizationId: user.organizationId, ...parsed.data })
    .onConflictDoNothing()
    .returning({ id: resources.id });
  if (!created) return { error: "Já existe um recurso com esse nome." };

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "resource.created",
    resourceType: "resource",
    resourceId: created.id,
    metadata: { name: parsed.data.name },
  });
  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function updateServiceAction(
  serviceId: string,
  formData: FormData,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };

  try {
    const [updated] = await db
      .update(services)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(services.id, serviceId), eq(services.organizationId, user.organizationId)))
      .returning({ id: services.id });
    if (!updated) return { error: "Serviço não encontrado." };

    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id ?? null,
      actorEmail: user.email ?? "",
      action: "service.updated",
      resourceType: "service",
      resourceId: updated.id,
      metadata: { name: parsed.data.name, durationMinutes: parsed.data.durationMinutes },
    });
    revalidatePath("/dashboard/schedule");
    return { success: true };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return {
      error: code === "23505" ? "Já existe um serviço com esse nome." : "Falha ao editar serviço.",
    };
  }
}

export async function updateResourceAction(
  resourceId: string,
  formData: FormData,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Dados inválidos." };

  try {
    const [updated] = await db
      .update(resources)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(resources.id, resourceId), eq(resources.organizationId, user.organizationId)))
      .returning({ id: resources.id });
    if (!updated) return { error: "Responsável não encontrado." };

    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id ?? null,
      actorEmail: user.email ?? "",
      action: "resource.updated",
      resourceType: "resource",
      resourceId: updated.id,
      metadata: { name: parsed.data.name },
    });
    revalidatePath("/dashboard/schedule");
    return { success: true };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return {
      error:
        code === "23505"
          ? "Já existe um responsável com esse nome."
          : "Falha ao editar responsável.",
    };
  }
}

export async function assignServiceToResourceAction(
  formData: FormData,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = assignmentSchema.safeParse({
    resourceId: formData.get("resourceId"),
    serviceId: formData.get("serviceId"),
  });
  if (!parsed.success) return { error: "Serviço ou recurso inválido." };

  const [[resource], [service]] = await Promise.all([
    db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.id, parsed.data.resourceId),
          eq(resources.organizationId, user.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.id, parsed.data.serviceId),
          eq(services.organizationId, user.organizationId),
        ),
      )
      .limit(1),
  ]);
  if (!resource || !service) return { error: "Serviço ou recurso não encontrado." };

  await db
    .insert(resourceServices)
    .values({
      organizationId: user.organizationId,
      resourceId: resource.id,
      serviceId: service.id,
    })
    .onConflictDoNothing();
  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function createAvailabilityRuleAction(
  formData: FormData,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = availabilityRuleSchema.safeParse({
    resourceId: formData.get("resourceId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Horário inválido." };

  const [resource] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.id, parsed.data.resourceId),
        eq(resources.organizationId, user.organizationId),
      ),
    )
    .limit(1);
  if (!resource) return { error: "Recurso não encontrado." };

  const [created] = await db
    .insert(availabilityRules)
    .values({ organizationId: user.organizationId, ...parsed.data })
    .returning({ id: availabilityRules.id });
  if (!created) return { error: "Não foi possível criar a disponibilidade." };

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "availability_rule.created",
    resourceType: "availability_rule",
    resourceId: created.id,
    metadata: parsed.data,
  });
  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function createAvailabilityExceptionAction(
  formData: FormData,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const parsed = availabilityExceptionSchema.safeParse({
    resourceId: formData.get("resourceId"),
    kind: formData.get("kind"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Período inválido." };

  const [[resource], [organization]] = await Promise.all([
    db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.id, parsed.data.resourceId),
          eq(resources.organizationId, user.organizationId),
        ),
      )
      .limit(1),
    db
      .select({ timezone: organizations.timezone })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1),
  ]);
  if (!resource || !organization) return { error: "Recurso ou empresa não encontrado." };

  try {
    const startsAt = zonedLocalDateTimeToUtc(parsed.data.startsAt, organization.timezone);
    const endsAt = zonedLocalDateTimeToUtc(parsed.data.endsAt, organization.timezone);
    if (startsAt >= endsAt) return { error: "O fim precisa ser posterior ao início." };

    const [created] = await db
      .insert(availabilityExceptions)
      .values({
        organizationId: user.organizationId,
        resourceId: resource.id,
        kind: parsed.data.kind,
        startsAt,
        endsAt,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      })
      .returning({ id: availabilityExceptions.id });
    if (!created) return { error: "Não foi possível criar a exceção." };

    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id ?? null,
      actorEmail: user.email ?? "",
      action: "availability_exception.created",
      resourceType: "availability_exception",
      resourceId: created.id,
      metadata: { resourceId: resource.id, kind: parsed.data.kind, startsAt, endsAt },
    });
    revalidatePath("/dashboard/schedule");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Período inválido." };
  }
}

export async function setServiceActiveAction(serviceId: string, isActive: boolean) {
  const user = await requireSchedulingManager();
  const [updated] = await db
    .update(services)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(services.id, serviceId), eq(services.organizationId, user.organizationId)))
    .returning({ id: services.id });
  revalidatePath("/dashboard/schedule");
  return { success: Boolean(updated) };
}

export async function setResourceActiveAction(resourceId: string, isActive: boolean) {
  const user = await requireSchedulingManager();
  const [updated] = await db
    .update(resources)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(resources.id, resourceId), eq(resources.organizationId, user.organizationId)))
    .returning({ id: resources.id });
  revalidatePath("/dashboard/schedule");
  return { success: Boolean(updated) };
}

export async function deleteAvailabilityRuleAction(
  ruleId: string,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const [deleted] = await db
    .delete(availabilityRules)
    .where(
      and(
        eq(availabilityRules.id, ruleId),
        eq(availabilityRules.organizationId, user.organizationId),
      ),
    )
    .returning({ id: availabilityRules.id });
  if (!deleted) return { error: "Regra de disponibilidade não encontrada." };

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "availability_rule.deleted",
    resourceType: "availability_rule",
    resourceId: deleted.id,
    metadata: {},
  });
  revalidatePath("/dashboard/schedule");
  return { success: true };
}

export async function deleteAvailabilityExceptionAction(
  exceptionId: string,
): Promise<SchedulingActionResult> {
  const user = await requireSchedulingManager();
  const [deleted] = await db
    .delete(availabilityExceptions)
    .where(
      and(
        eq(availabilityExceptions.id, exceptionId),
        eq(availabilityExceptions.organizationId, user.organizationId),
      ),
    )
    .returning({ id: availabilityExceptions.id });
  if (!deleted) return { error: "Exceção não encontrada." };

  await writeAuditLog({
    organizationId: user.organizationId,
    actorId: user.id ?? null,
    actorEmail: user.email ?? "",
    action: "availability_exception.deleted",
    resourceType: "availability_exception",
    resourceId: deleted.id,
    metadata: {},
  });
  revalidatePath("/dashboard/schedule");
  return { success: true };
}
