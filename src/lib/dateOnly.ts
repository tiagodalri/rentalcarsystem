/**
 * Parse a date-only string (YYYY-MM-DD) as LOCAL noon to avoid UTC timezone shifts.
 * Without this, `new Date("2026-06-26")` is parsed as UTC midnight and renders as
 * Jun 25 in negative timezones (e.g. Orlando UTC-4).
 */
export function parseDateOnly(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  // If it already has a time component, parse as-is.
  if (/T\d{2}:/.test(value)) return new Date(value);
  // Pure YYYY-MM-DD → anchor at local noon.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  return new Date(value);
}
