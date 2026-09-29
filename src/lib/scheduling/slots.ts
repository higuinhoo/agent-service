import { periodsOverlap, type TimePeriod } from "./periods";

export interface AvailabilityWindow extends TimePeriod {
  resourceId: string;
  resourceName: string;
}

export interface AvailableSlot extends TimePeriod {
  resourceId: string;
  resourceName: string;
}

export function buildAvailableSlots(params: {
  windows: AvailabilityWindow[];
  busyPeriods: Array<TimePeriod & { resourceId: string }>;
  durationMinutes: number;
  stepMinutes?: number;
  limit?: number;
}): AvailableSlot[] {
  const stepMs = (params.stepMinutes ?? 15) * 60_000;
  const durationMs = params.durationMinutes * 60_000;
  const limit = params.limit ?? 24;
  const slots = new Map<string, AvailableSlot>();

  for (const window of params.windows) {
    for (
      let startMs = window.startsAt.getTime();
      startMs + durationMs <= window.endsAt.getTime();
      startMs += stepMs
    ) {
      const slot = {
        resourceId: window.resourceId,
        resourceName: window.resourceName,
        startsAt: new Date(startMs),
        endsAt: new Date(startMs + durationMs),
      };
      const isBusy = params.busyPeriods.some(
        (busy) => busy.resourceId === slot.resourceId && periodsOverlap(slot, busy),
      );
      if (!isBusy) slots.set(`${slot.resourceId}:${slot.startsAt.toISOString()}`, slot);
      if (slots.size >= limit) return [...slots.values()];
    }
  }

  return [...slots.values()].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
}
