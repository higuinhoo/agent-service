export interface TimePeriod {
  startsAt: Date;
  endsAt: Date;
}

export function isValidPeriod(period: TimePeriod): boolean {
  return (
    Number.isFinite(period.startsAt.getTime()) &&
    Number.isFinite(period.endsAt.getTime()) &&
    period.startsAt < period.endsAt
  );
}

export function periodsOverlap(left: TimePeriod, right: TimePeriod): boolean {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}
