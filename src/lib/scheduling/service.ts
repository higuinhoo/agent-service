import { and, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  availabilityExceptions,
  availabilityRules,
  bookingHolds,
  bookings,
  conversations,
  organizations,
  resourceServices,
  resources,
  services,
} from "@/lib/db/schema";
import { isValidPeriod } from "./periods";
import { buildAvailableSlots } from "./slots";
import { zonedLocalDateTimeToUtc } from "./timezone";

export class SchedulingConflictError extends Error {
  constructor(message = "Este horário não está mais disponível.") {
    super(message);
    this.name = "SchedulingConflictError";
  }
}

export class SchedulingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingValidationError";
  }
}

interface CreateHoldInput {
  organizationId: string;
  resourceId: string;
  serviceId: string;
  contactId?: string;
  idempotencyKey: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
  controlGuard?: AiControlGuard;
}

interface ConfirmBookingInput {
  organizationId: string;
  holdId: string;
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  controlGuard?: AiControlGuard;
}

interface FindAvailableSlotsInput {
  organizationId: string;
  serviceId: string;
  date: string;
  resourceId?: string;
  limit?: number;
}

interface RescheduleBookingInput {
  organizationId: string;
  bookingId: string;
  holdId: string;
  idempotencyKey: string;
  controlGuard?: AiControlGuard;
}

interface AiControlGuard {
  conversationId: string;
  controlVersion: string;
}

function assertPeriod(startsAt: Date, endsAt: Date) {
  if (!isValidPeriod({ startsAt, endsAt })) {
    throw new SchedulingValidationError("O início deve ser anterior ao fim do horário.");
  }
}

function assertIdempotentMatch(
  existing: { resourceId: string; serviceId: string; startsAt: Date; endsAt: Date },
  expected: { resourceId: string; serviceId: string; startsAt: Date; endsAt: Date },
) {
  if (
    existing.resourceId !== expected.resourceId ||
    existing.serviceId !== expected.serviceId ||
    existing.startsAt.getTime() !== expected.startsAt.getTime() ||
    existing.endsAt.getTime() !== expected.endsAt.getTime()
  ) {
    throw new SchedulingValidationError("A chave de idempotência já foi usada com outros dados.");
  }
}

async function lockResource(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  resourceId: string,
) {
  const lockKey = `${organizationId}:${resourceId}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
}

async function lockResources(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  resourceIds: string[],
) {
  for (const resourceId of [...new Set(resourceIds)].sort()) {
    await lockResource(tx, organizationId, resourceId);
  }
}

async function assertAiControl(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  guard?: AiControlGuard,
) {
  if (!guard) return;
  const [conversation] = await tx
    .select({ status: conversations.status, controlVersion: conversations.controlVersion })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, guard.conversationId),
        eq(conversations.organizationId, organizationId),
      ),
    )
    .for("update")
    .limit(1);
  if (
    !conversation ||
    conversation.status !== "AI_ACTIVE" ||
    conversation.controlVersion !== guard.controlVersion
  ) {
    throw new SchedulingConflictError("O atendimento foi assumido por uma pessoa.");
  }
}

export async function expireBookingHolds(organizationId: string, now = new Date()) {
  return db
    .update(bookingHolds)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(
      and(
        eq(bookingHolds.organizationId, organizationId),
        eq(bookingHolds.status, "ACTIVE"),
        lte(bookingHolds.expiresAt, now),
      ),
    )
    .returning({ id: bookingHolds.id });
}

export async function expireAllBookingHolds(now = new Date()) {
  return db
    .update(bookingHolds)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(and(eq(bookingHolds.status, "ACTIVE"), lte(bookingHolds.expiresAt, now)))
    .returning({ id: bookingHolds.id });
}

export async function createBookingHold(input: CreateHoldInput) {
  assertPeriod(input.startsAt, input.endsAt);
  const requestedAt = new Date();
  if (input.startsAt <= requestedAt) {
    throw new SchedulingValidationError("O horário precisa estar no futuro.");
  }
  if (input.expiresAt <= requestedAt) {
    throw new SchedulingValidationError("O hold precisa expirar no futuro.");
  }

  return db.transaction(async (tx) => {
    await assertAiControl(tx, input.organizationId, input.controlGuard);
    const [existing] = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing) {
      assertIdempotentMatch(existing, input);
      return existing;
    }

    await lockResource(tx, input.organizationId, input.resourceId);

    const [existingAfterLock] = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingAfterLock) {
      assertIdempotentMatch(existingAfterLock, input);
      return existingAfterLock;
    }

    const [offering] = await tx
      .select({ resourceId: resourceServices.resourceId })
      .from(resourceServices)
      .innerJoin(
        resources,
        and(
          eq(resources.id, resourceServices.resourceId),
          eq(resources.organizationId, resourceServices.organizationId),
        ),
      )
      .innerJoin(
        services,
        and(
          eq(services.id, resourceServices.serviceId),
          eq(services.organizationId, resourceServices.organizationId),
        ),
      )
      .where(
        and(
          eq(resourceServices.organizationId, input.organizationId),
          eq(resourceServices.resourceId, input.resourceId),
          eq(resourceServices.serviceId, input.serviceId),
          eq(resources.isActive, true),
          eq(services.isActive, true),
        ),
      )
      .limit(1);

    if (!offering) {
      throw new SchedulingValidationError("Serviço ou recurso indisponível para esta empresa.");
    }

    const [recurringAvailability] = await tx
      .select({ id: availabilityRules.id })
      .from(availabilityRules)
      .innerJoin(organizations, eq(organizations.id, availabilityRules.organizationId))
      .where(
        and(
          eq(availabilityRules.organizationId, input.organizationId),
          eq(availabilityRules.resourceId, input.resourceId),
          eq(availabilityRules.isActive, true),
          sql`extract(dow from ${input.startsAt}::timestamptz at time zone ${organizations.timezone})::integer = ${availabilityRules.weekday}`,
          sql`(${input.startsAt}::timestamptz at time zone ${organizations.timezone})::date = (${input.endsAt}::timestamptz at time zone ${organizations.timezone})::date`,
          sql`(${input.startsAt}::timestamptz at time zone ${organizations.timezone})::time >= ${availabilityRules.startTime}`,
          sql`(${input.endsAt}::timestamptz at time zone ${organizations.timezone})::time <= ${availabilityRules.endTime}`,
        ),
      )
      .limit(1);

    const [availableException] = await tx
      .select({ id: availabilityExceptions.id })
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.organizationId, input.organizationId),
          eq(availabilityExceptions.resourceId, input.resourceId),
          eq(availabilityExceptions.kind, "AVAILABLE"),
          lte(availabilityExceptions.startsAt, input.startsAt),
          gte(availabilityExceptions.endsAt, input.endsAt),
        ),
      )
      .limit(1);

    if (!recurringAvailability && !availableException) {
      throw new SchedulingConflictError("O responsável não atende nesse horário.");
    }

    const [blockedException] = await tx
      .select({ id: availabilityExceptions.id })
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.organizationId, input.organizationId),
          eq(availabilityExceptions.resourceId, input.resourceId),
          eq(availabilityExceptions.kind, "BLOCKED"),
          lt(availabilityExceptions.startsAt, input.endsAt),
          gt(availabilityExceptions.endsAt, input.startsAt),
        ),
      )
      .limit(1);

    if (blockedException) {
      throw new SchedulingConflictError("O responsável está bloqueado nesse horário.");
    }

    const now = new Date();
    await tx
      .update(bookingHolds)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(
        and(
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.resourceId, input.resourceId),
          eq(bookingHolds.status, "ACTIVE"),
          lte(bookingHolds.expiresAt, now),
        ),
      );

    const [conflictingBooking] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, input.organizationId),
          eq(bookings.resourceId, input.resourceId),
          eq(bookings.status, "CONFIRMED"),
          lt(bookings.startsAt, input.endsAt),
          gt(bookings.endsAt, input.startsAt),
        ),
      )
      .limit(1);

    const [conflictingHold] = await tx
      .select({ id: bookingHolds.id })
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.resourceId, input.resourceId),
          eq(bookingHolds.status, "ACTIVE"),
          gt(bookingHolds.expiresAt, now),
          lt(bookingHolds.startsAt, input.endsAt),
          gt(bookingHolds.endsAt, input.startsAt),
        ),
      )
      .limit(1);

    if (conflictingBooking || conflictingHold) {
      throw new SchedulingConflictError();
    }

    const [created] = await tx
      .insert(bookingHolds)
      .values({
        organizationId: input.organizationId,
        resourceId: input.resourceId,
        serviceId: input.serviceId,
        ...(input.contactId ? { contactId: input.contactId } : {}),
        idempotencyKey: input.idempotencyKey,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!created) throw new Error("Não foi possível criar o hold.");
    return created;
  });
}

export async function confirmBookingFromHold(input: ConfirmBookingInput) {
  return db.transaction(async (tx) => {
    await assertAiControl(tx, input.organizationId, input.controlGuard);
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, input.organizationId),
          eq(bookings.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [hold] = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.id, input.holdId),
          eq(bookingHolds.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!hold || hold.status !== "ACTIVE") {
      throw new SchedulingConflictError("A reserva temporária não está mais ativa.");
    }

    await lockResource(tx, input.organizationId, hold.resourceId);
    const now = new Date();

    const [existingAfterLock] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, input.organizationId),
          eq(bookings.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existingAfterLock) return existingAfterLock;

    const [currentHold] = await tx
      .select()
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.id, input.holdId),
          eq(bookingHolds.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!currentHold || currentHold.status !== "ACTIVE") {
      throw new SchedulingConflictError("A reserva temporária não está mais ativa.");
    }

    if (currentHold.expiresAt <= now) {
      await tx
        .update(bookingHolds)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(
          and(
            eq(bookingHolds.id, currentHold.id),
            eq(bookingHolds.organizationId, input.organizationId),
          ),
        );
      throw new SchedulingConflictError("A reserva temporária expirou.");
    }

    const [consumed] = await tx
      .update(bookingHolds)
      .set({ status: "CONSUMED", updatedAt: now })
      .where(
        and(
          eq(bookingHolds.id, currentHold.id),
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.status, "ACTIVE"),
        ),
      )
      .returning({ id: bookingHolds.id });

    if (!consumed) throw new SchedulingConflictError();

    const [created] = await tx
      .insert(bookings)
      .values({
        organizationId: input.organizationId,
        resourceId: currentHold.resourceId,
        serviceId: currentHold.serviceId,
        ...(currentHold.contactId ? { contactId: currentHold.contactId } : {}),
        holdId: currentHold.id,
        idempotencyKey: input.idempotencyKey,
        startsAt: currentHold.startsAt,
        endsAt: currentHold.endsAt,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        ...(input.notes ? { notes: input.notes } : {}),
      })
      .returning();

    if (!created) throw new Error("Não foi possível confirmar o agendamento.");
    return created;
  });
}

export async function findAvailableSlots(input: FindAvailableSlotsInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new SchedulingValidationError("Data inválida; use AAAA-MM-DD.");
  }

  const [catalog] = await db
    .select({ durationMinutes: services.durationMinutes, timezone: organizations.timezone })
    .from(services)
    .innerJoin(organizations, eq(organizations.id, services.organizationId))
    .where(
      and(
        eq(services.id, input.serviceId),
        eq(services.organizationId, input.organizationId),
        eq(services.isActive, true),
      ),
    )
    .limit(1);
  if (!catalog) throw new SchedulingValidationError("Serviço não encontrado.");

  const offerings = await db
    .select({ resourceId: resources.id, resourceName: resources.name })
    .from(resourceServices)
    .innerJoin(
      resources,
      and(
        eq(resources.id, resourceServices.resourceId),
        eq(resources.organizationId, resourceServices.organizationId),
      ),
    )
    .where(
      and(
        eq(resourceServices.organizationId, input.organizationId),
        eq(resourceServices.serviceId, input.serviceId),
        eq(resources.isActive, true),
        ...(input.resourceId ? [eq(resources.id, input.resourceId)] : []),
      ),
    );
  if (offerings.length === 0) return [];

  const localDate = new Date(`${input.date}T00:00:00.000Z`);
  if (Number.isNaN(localDate.getTime())) throw new SchedulingValidationError("Data inválida.");
  const weekday = localDate.getUTCDay();
  localDate.setUTCDate(localDate.getUTCDate() + 1);
  const nextDate = localDate.toISOString().slice(0, 10);
  const dayStart = zonedLocalDateTimeToUtc(`${input.date}T00:00`, catalog.timezone);
  const dayEnd = zonedLocalDateTimeToUtc(`${nextDate}T00:00`, catalog.timezone);
  const resourceIds = offerings.map((offering) => offering.resourceId);

  const [rules, exceptions, confirmedBookings, activeHolds] = await Promise.all([
    db
      .select({
        resourceId: availabilityRules.resourceId,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.organizationId, input.organizationId),
          inArray(availabilityRules.resourceId, resourceIds),
          eq(availabilityRules.weekday, weekday),
          eq(availabilityRules.isActive, true),
        ),
      ),
    db
      .select({
        resourceId: availabilityExceptions.resourceId,
        kind: availabilityExceptions.kind,
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
      })
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.organizationId, input.organizationId),
          inArray(availabilityExceptions.resourceId, resourceIds),
          lt(availabilityExceptions.startsAt, dayEnd),
          gt(availabilityExceptions.endsAt, dayStart),
        ),
      ),
    db
      .select({
        resourceId: bookings.resourceId,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, input.organizationId),
          inArray(bookings.resourceId, resourceIds),
          eq(bookings.status, "CONFIRMED"),
          lt(bookings.startsAt, dayEnd),
          gt(bookings.endsAt, dayStart),
        ),
      ),
    db
      .select({
        resourceId: bookingHolds.resourceId,
        startsAt: bookingHolds.startsAt,
        endsAt: bookingHolds.endsAt,
      })
      .from(bookingHolds)
      .where(
        and(
          eq(bookingHolds.organizationId, input.organizationId),
          inArray(bookingHolds.resourceId, resourceIds),
          eq(bookingHolds.status, "ACTIVE"),
          gt(bookingHolds.expiresAt, new Date()),
          lt(bookingHolds.startsAt, dayEnd),
          gt(bookingHolds.endsAt, dayStart),
        ),
      ),
  ]);

  const names = new Map(offerings.map((offering) => [offering.resourceId, offering.resourceName]));
  const windows = [
    ...rules.map((rule) => ({
      resourceId: rule.resourceId,
      resourceName: names.get(rule.resourceId) ?? "Responsável",
      startsAt: zonedLocalDateTimeToUtc(
        `${input.date}T${rule.startTime.slice(0, 5)}`,
        catalog.timezone,
      ),
      endsAt: zonedLocalDateTimeToUtc(
        `${input.date}T${rule.endTime.slice(0, 5)}`,
        catalog.timezone,
      ),
    })),
    ...exceptions
      .filter((exception) => exception.kind === "AVAILABLE")
      .map((exception) => ({
        resourceId: exception.resourceId,
        resourceName: names.get(exception.resourceId) ?? "Responsável",
        startsAt: exception.startsAt,
        endsAt: exception.endsAt,
      })),
  ];
  const busyPeriods = [
    ...confirmedBookings,
    ...activeHolds,
    ...exceptions
      .filter((exception) => exception.kind === "BLOCKED")
      .map((exception) => ({
        resourceId: exception.resourceId,
        startsAt: exception.startsAt,
        endsAt: exception.endsAt,
      })),
  ];

  return buildAvailableSlots({
    windows: windows.filter((window) => window.endsAt > new Date()),
    busyPeriods,
    durationMinutes: catalog.durationMinutes,
    limit: input.limit ?? 12,
  }).filter((slot) => slot.startsAt > new Date());
}

export async function rescheduleBookingFromHold(input: RescheduleBookingInput) {
  return db.transaction(async (tx) => {
    await assertAiControl(tx, input.organizationId, input.controlGuard);
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, input.organizationId),
          eq(bookings.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [[original], [hold]] = await Promise.all([
      tx
        .select()
        .from(bookings)
        .where(
          and(eq(bookings.id, input.bookingId), eq(bookings.organizationId, input.organizationId)),
        )
        .limit(1),
      tx
        .select()
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.id, input.holdId),
            eq(bookingHolds.organizationId, input.organizationId),
          ),
        )
        .limit(1),
    ]);
    if (!original || original.status !== "CONFIRMED") {
      throw new SchedulingConflictError("O agendamento original não está confirmado.");
    }
    if (!hold || hold.status !== "ACTIVE") {
      throw new SchedulingConflictError("A nova reserva temporária não está ativa.");
    }

    await lockResources(tx, input.organizationId, [original.resourceId, hold.resourceId]);

    const [[currentOriginal], [currentHold], [existingAfterLock]] = await Promise.all([
      tx
        .select()
        .from(bookings)
        .where(
          and(eq(bookings.id, input.bookingId), eq(bookings.organizationId, input.organizationId)),
        )
        .limit(1),
      tx
        .select()
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.id, input.holdId),
            eq(bookingHolds.organizationId, input.organizationId),
          ),
        )
        .limit(1),
      tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.organizationId, input.organizationId),
            eq(bookings.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1),
    ]);
    if (existingAfterLock) return existingAfterLock;
    if (!currentOriginal || currentOriginal.status !== "CONFIRMED") {
      throw new SchedulingConflictError("O agendamento original foi alterado.");
    }
    if (!currentHold || currentHold.status !== "ACTIVE" || currentHold.expiresAt <= new Date()) {
      throw new SchedulingConflictError("A nova reserva temporária expirou.");
    }

    const now = new Date();
    const [cancelled] = await tx
      .update(bookings)
      .set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(bookings.id, currentOriginal.id),
          eq(bookings.organizationId, input.organizationId),
          eq(bookings.status, "CONFIRMED"),
        ),
      )
      .returning({ id: bookings.id });
    const [consumed] = await tx
      .update(bookingHolds)
      .set({ status: "CONSUMED", updatedAt: now })
      .where(
        and(
          eq(bookingHolds.id, currentHold.id),
          eq(bookingHolds.organizationId, input.organizationId),
          eq(bookingHolds.status, "ACTIVE"),
        ),
      )
      .returning({ id: bookingHolds.id });
    if (!cancelled || !consumed) throw new SchedulingConflictError();

    const [replacement] = await tx
      .insert(bookings)
      .values({
        organizationId: input.organizationId,
        resourceId: currentHold.resourceId,
        serviceId: currentHold.serviceId,
        ...(currentHold.contactId ? { contactId: currentHold.contactId } : {}),
        holdId: currentHold.id,
        idempotencyKey: input.idempotencyKey,
        startsAt: currentHold.startsAt,
        endsAt: currentHold.endsAt,
        customerName: currentOriginal.customerName,
        customerPhone: currentOriginal.customerPhone,
        ...(currentOriginal.notes ? { notes: currentOriginal.notes } : {}),
      })
      .returning();
    if (!replacement) throw new Error("Não foi possível reagendar.");
    return replacement;
  });
}

export async function cancelBooking(
  organizationId: string,
  bookingId: string,
  controlGuard?: AiControlGuard,
) {
  return db.transaction(async (tx) => {
    await assertAiControl(tx, organizationId, controlGuard);
    const [current] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.organizationId, organizationId)))
      .limit(1);
    if (!current) return null;
    if (current.status === "CANCELLED") return current;
    if (current.status !== "CONFIRMED") {
      throw new SchedulingValidationError("Somente agendamentos confirmados podem ser cancelados.");
    }

    const now = new Date();
    const [cancelled] = await tx
      .update(bookings)
      .set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.organizationId, organizationId),
          eq(bookings.status, "CONFIRMED"),
        ),
      )
      .returning();
    return cancelled ?? null;
  });
}
