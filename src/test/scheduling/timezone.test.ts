import { describe, expect, it } from "vitest";
import { zonedLocalDateTimeToUtc } from "@/lib/scheduling/timezone";

describe("conversão de horário da empresa", () => {
  it("converte horário de São Paulo sem depender do fuso do servidor", () => {
    expect(zonedLocalDateTimeToUtc("2026-09-29T14:30", "America/Sao_Paulo").toISOString()).toBe(
      "2026-09-29T17:30:00.000Z",
    );
  });

  it("rejeita formato sem data e hora local completas", () => {
    expect(() => zonedLocalDateTimeToUtc("2026-09-29", "America/Sao_Paulo")).toThrow(
      "Data e hora local inválidas",
    );
  });
});
