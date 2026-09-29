import { describe, expect, it } from "vitest";
import { buildAvailableSlots } from "@/lib/scheduling/slots";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 29, hour, minute));

describe("geração de horários disponíveis", () => {
  it("remove períodos ocupados e preserva horários adjacentes", () => {
    const slots = buildAvailableSlots({
      windows: [
        {
          resourceId: "resource-a",
          resourceName: "Ana",
          startsAt: at(9),
          endsAt: at(11),
        },
      ],
      busyPeriods: [{ resourceId: "resource-a", startsAt: at(9, 30), endsAt: at(10) }],
      durationMinutes: 30,
      stepMinutes: 30,
    });

    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      at(9).toISOString(),
      at(10).toISOString(),
      at(10, 30).toISOString(),
    ]);
  });

  it("não mistura ocupação de recursos diferentes", () => {
    const slots = buildAvailableSlots({
      windows: [
        {
          resourceId: "resource-a",
          resourceName: "Ana",
          startsAt: at(9),
          endsAt: at(10),
        },
      ],
      busyPeriods: [{ resourceId: "resource-b", startsAt: at(9), endsAt: at(10) }],
      durationMinutes: 60,
    });

    expect(slots).toHaveLength(1);
  });
});
