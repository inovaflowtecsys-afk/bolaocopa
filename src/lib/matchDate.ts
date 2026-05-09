const SHORT_MONTHS_PT_BR = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

function parseMatchDateParts(value: string) {
  if (!value) return null;

  const normalized = value.trim().replace(' ', 'T');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return {
    year,
    month,
    day,
    hour,
    minute,
  };
}

export function datetimeLocalToIso(value: string): string {
  const parts = parseMatchDateParts(value);
  if (!parts) return value;

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`;
}

export function isoToDatetimeLocal(value: string): string {
  const parts = parseMatchDateParts(value);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatMatchDate(value: string): string {
  const parts = parseMatchDateParts(value);
  if (!parts) return value;

  const monthIndex = Number(parts.month) - 1;
  const monthLabel = SHORT_MONTHS_PT_BR[monthIndex] ?? parts.month;

  return `${parts.day} ${monthLabel}, ${parts.hour}:${parts.minute}`;
}
