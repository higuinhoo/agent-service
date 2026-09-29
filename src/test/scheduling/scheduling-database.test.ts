import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const databaseSuite = process.env["RUN_DATABASE_TESTS"] === "1" ? describe : describe.skip;

databaseSuite("agenda com PostgreSQL real", () => {
  let db: typeof import("@/lib/db/client").db;
  let schema: typeof import("@/lib/db/schema");
  let scheduling: typeof import("@/lib/scheduling");
  let organizationAId = "";
  let organizationBId = "";
  let serviceId = "";
  let resourceId = "";
  let conversationId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db/client"));
    schema = await import("@/lib/db/schema");
    scheduling = await import("@/lib/scheduling");

    const suffix = crypto.randomUUID().slice(0, 8);
    const [organizationA, organizationB] = await db
      .insert(schema.organizations)
      .values([
        { name: "Agenda Teste A", slug: `agenda-teste-a-${suffix}`, timezone: "UTC" },
        { name: "Agenda Teste B", slug: `agenda-teste-b-${suffix}`, timezone: "UTC" },
      ])
      .returning({ id: schema.organizations.id });
    if (!organizationA || !organizationB) throw new Error("Falha ao criar organizações de teste.");
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [service] = await db
      .insert(schema.services)
      .values({ organizationId: organizationAId, name: "Consulta", durationMinutes: 30 })
      .returning({ id: schema.services.id });
    const [resource] = await db
      .insert(schema.resources)
      .values({ organizationId: organizationAId, name: "Profissional A" })
      .returning({ id: schema.resources.id });
    if (!service || !resource) throw new Error("Falha ao criar catálogo de teste.");
    serviceId = service.id;
    resourceId = resource.id;

    await db.insert(schema.resourceServices).values({
      organizationId: organizationAId,
      resourceId,
      serviceId,
    });

    const [contact] = await db
      .insert(schema.contacts)
      .values({ organizationId: organizationAId, name: "Cliente Teste", phone: "5511999999999" })
      .returning({ id: schema.contacts.id });
    if (!contact) throw new Error("Falha ao criar contato de teste.");
    const [conversation] = await db
      .insert(schema.conversations)
      .values({
        organizationId: organizationAId,
        contactId: contact.id,
        status: "AI_ACTIVE",
        controlVersion: "1",
      })
      .returning({ id: schema.conversations.id });
    if (!conversation) throw new Error("Falha ao criar conversa de teste.");
    conversationId = conversation.id;

    for (let weekday = 0; weekday <= 6; weekday++) {
      await db.insert(schema.availabilityRules).values({
        organizationId: organizationAId,
        resourceId,
        weekday,
        startTime: "00:00",
        endTime: "23:59",
      });
    }
  });

  afterAll(async () => {
    if (organizationAId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, organizationAId));
    }
    if (organizationBId) {
      await db.delete(schema.organizations).where(eq(schema.organizations.id, organizationBId));
    }
  });

  it("aceita somente uma de duas tentativas simultâneas no mesmo horário", async () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60_000);
    startsAt.setUTCMinutes(0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    const attempts = await Promise.allSettled([
      scheduling.createBookingHold({
        organizationId: organizationAId,
        resourceId,
        serviceId,
        idempotencyKey: `concurrent-a-${crypto.randomUUID()}`,
        startsAt,
        endsAt,
        expiresAt,
      }),
      scheduling.createBookingHold({
        organizationId: organizationAId,
        resourceId,
        serviceId,
        idempotencyKey: `concurrent-b-${crypto.randomUUID()}`,
        startsAt,
        endsAt,
        expiresAt,
      }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
  });

  it("libera o horário quando o hold expira", async () => {
    const startsAt = new Date(Date.now() + 48 * 60 * 60_000);
    startsAt.setUTCMinutes(0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

    const first = await scheduling.createBookingHold({
      organizationId: organizationAId,
      resourceId,
      serviceId,
      idempotencyKey: `expiring-${crypto.randomUUID()}`,
      startsAt,
      endsAt,
      expiresAt: new Date(Date.now() + 50),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = await scheduling.createBookingHold({
      organizationId: organizationAId,
      resourceId,
      serviceId,
      idempotencyKey: `after-expiry-${crypto.randomUUID()}`,
      startsAt,
      endsAt,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    expect(second.id).not.toBe(first.id);
    const [expired] = await db
      .select({ status: schema.bookingHolds.status })
      .from(schema.bookingHolds)
      .where(eq(schema.bookingHolds.id, first.id));
    expect(expired?.status).toBe("EXPIRED");
  });

  it("não permite usar catálogo pertencente a outra empresa", async () => {
    const startsAt = new Date(Date.now() + 72 * 60 * 60_000);
    startsAt.setUTCMinutes(0, 0, 0);

    await expect(
      scheduling.createBookingHold({
        organizationId: organizationBId,
        resourceId,
        serviceId,
        idempotencyKey: `cross-tenant-${crypto.randomUUID()}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      }),
    ).rejects.toThrow("indisponível para esta empresa");
  });

  it("reagenda atomicamente sem cancelar o horário original antes da nova reserva", async () => {
    const originalStart = new Date(Date.now() + 96 * 60 * 60_000);
    originalStart.setUTCMinutes(0, 0, 0);
    const originalHold = await scheduling.createBookingHold({
      organizationId: organizationAId,
      resourceId,
      serviceId,
      idempotencyKey: `original-hold-${crypto.randomUUID()}`,
      startsAt: originalStart,
      endsAt: new Date(originalStart.getTime() + 30 * 60_000),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const originalBooking = await scheduling.confirmBookingFromHold({
      organizationId: organizationAId,
      holdId: originalHold.id,
      idempotencyKey: `original-booking-${crypto.randomUUID()}`,
      customerName: "Cliente Teste",
      customerPhone: "5511999999999",
    });

    const replacementStart = new Date(originalStart.getTime() + 60 * 60_000);
    const replacementHold = await scheduling.createBookingHold({
      organizationId: organizationAId,
      resourceId,
      serviceId,
      idempotencyKey: `replacement-hold-${crypto.randomUUID()}`,
      startsAt: replacementStart,
      endsAt: new Date(replacementStart.getTime() + 30 * 60_000),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const replacement = await scheduling.rescheduleBookingFromHold({
      organizationId: organizationAId,
      bookingId: originalBooking.id,
      holdId: replacementHold.id,
      idempotencyKey: `reschedule-${crypto.randomUUID()}`,
    });

    expect(replacement.startsAt).toEqual(replacementStart);
    const [cancelled] = await db
      .select({ status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, originalBooking.id));
    expect(cancelled?.status).toBe("CANCELLED");
  });

  it("impede efeito da IA depois que um humano assume a conversa", async () => {
    await db
      .update(schema.conversations)
      .set({ status: "HUMAN_ACTIVE", controlVersion: "2" })
      .where(eq(schema.conversations.id, conversationId));
    const startsAt = new Date(Date.now() + 120 * 60 * 60_000);
    startsAt.setUTCMinutes(0, 0, 0);

    await expect(
      scheduling.createBookingHold({
        organizationId: organizationAId,
        resourceId,
        serviceId,
        idempotencyKey: `human-takeover-${crypto.randomUUID()}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        controlGuard: { conversationId, controlVersion: "1" },
      }),
    ).rejects.toThrow("assumido por uma pessoa");
  });
});
