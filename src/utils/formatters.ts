/** Format an ISO date string or Date object to "DD/MM/YYYY".
 *  Strings are read as UTC (matches API ISO timestamps).
 *  Date objects are read as local time (matches a user-picked date).
 *  Returns em-dash for null/undefined/invalid. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '\u2014';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '\u2014';
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return '\u2014';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/** Format a Date object to YYYY-MM-DD for API params. */
export function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Format a number with 2 decimal places. Returns em-dash for null/undefined/NaN. */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '\u2014';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Check if a currency string represents SAR (code or Arabic name). */
export function isSAR(currency: string): boolean {
  return currency === 'SAR' || currency === 'ريال سعودي';
}

/** Check if a currency string represents USD (code or Arabic name). */
export function isUSD(currency: string): boolean {
  return currency === 'USD' || currency === 'دولار أمريكي';
}

/** Format a number with currency symbol. SAR → ر.س, USD → $. */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? '-' : '';

  if (isSAR(currency)) return `${sign}${formatted} ر.س`;
  if (isUSD(currency)) return `${sign}$ ${formatted}`;
  return `${sign}${currency} ${formatted}`;
}
