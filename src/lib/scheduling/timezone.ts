const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(value["year"]),
    Number(value["month"]) - 1,
    Number(value["day"]),
    Number(value["hour"]),
    Number(value["minute"]),
    Number(value["second"]),
  );
  return representedAsUtc - date.getTime();
}

export function zonedLocalDateTimeToUtc(value: string, timeZone: string): Date {
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error("Data e hora local inválidas.");

  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const firstGuess = new Date(localAsUtc);
  const corrected = new Date(localAsUtc - timezoneOffsetMs(firstGuess, timeZone));
  const finalDate = new Date(localAsUtc - timezoneOffsetMs(corrected, timeZone));

  const roundTrip = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(finalDate)
    .replace(" ", "T");
  if (roundTrip !== value) throw new Error("Horário inexistente ou ambíguo nesse fuso.");
  return finalDate;
}
