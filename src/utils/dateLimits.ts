export const MAX_FUTURE_DAYS = 3;

export function getMaxAllowedDate(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + MAX_FUTURE_DAYS);
  return d;
}

export function getMaxAllowedDateEndOfDay(now: Date = new Date()): Date {
  const d = getMaxAllowedDate(now);
  d.setHours(23, 59, 59, 999);
  return d;
}
