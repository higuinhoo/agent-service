import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "migrations/0000_fat_young_avengers.sql"),
  "utf8",
);

describe("contrato da migration de agenda", () => {
  it("impõe isolamento de tenant nas referências da agenda", () => {
    expect(migration).toContain('CONSTRAINT "booking_holds_tenant_resource_fk"');
    expect(migration).toContain('CONSTRAINT "bookings_tenant_service_fk"');
    expect(migration).toContain('FOREIGN KEY ("organization_id", "resource_id")');
  });

  it("serializa disputas e bloqueia sobreposição no banco", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain('CONSTRAINT "booking_holds_no_overlap" EXCLUDE USING gist');
    expect(migration).toContain('CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist');
    expect(migration).toContain("schedule slot overlaps an active reservation");
  });

  it("expira holds antes de avaliar um novo horário", () => {
    expect(migration).toContain("SET status = 'EXPIRED'");
    expect(migration).toContain("expires_at <= now()");
  });
});
