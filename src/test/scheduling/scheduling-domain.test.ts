import { describe, expect, it } from "vitest";
import { isValidPeriod, periodsOverlap } from "@/lib/scheduling/periods";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 29, hour, minute));

describe("regras de períodos da agenda", () => {
  it("rejeita períodos vazios, invertidos e datas inválidas", () => {
    expect(isValidPeriod({ startsAt: at(10), endsAt: at(10) })).toBe(false);
    expect(isValidPeriod({ startsAt: at(11), endsAt: at(10) })).toBe(false);
    expect(isValidPeriod({ startsAt: new Date("inválida"), endsAt: at(10) })).toBe(false);
  });

  it("detecta interseção real entre dois horários", () => {
    expect(
      periodsOverlap(
        { startsAt: at(10), endsAt: at(11) },
        { startsAt: at(10, 30), endsAt: at(11, 30) },
      ),
    ).toBe(true);
  });

  it("permite horários adjacentes usando intervalo semiaberto", () => {
    expect(
      periodsOverlap({ startsAt: at(10), endsAt: at(11) }, { startsAt: at(11), endsAt: at(12) }),
    ).toBe(false);
  });
});
