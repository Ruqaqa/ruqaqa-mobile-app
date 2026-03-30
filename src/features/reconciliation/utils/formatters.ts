import { ReconciliationEmployee, ReconciliationChannel } from '../types';

export { formatDate, formatDateParam, formatCurrencyAmount as formatAmount } from '@/utils/formatters';

/** Get display string for a reconciliation party (from/to). */
export function getPartyDisplay(
  type: string | null,
  employee: ReconciliationEmployee | null,
): string {
  if (type === null) return '\u2014';

  // Check type first — non-employee types return the type label directly
  if (type === 'employee') {
    return employee?.name ?? '\u2014';
  }

  // For المحفظة, بطاقة البلاد — return the Arabic label as-is (matches Flutter)
  return type;
}

/** Get display string for a channel. */
export function getChannelDisplay(
  channel: ReconciliationChannel | null,
): string {
  if (!channel || !channel.name) return '\u2014';
  return channel.name;
}

/** Type badge configuration for reconciliation types. */
export function getTypeBadgeConfig(
  type: string,
): { color: string; label: string } {
  switch (type) {
    case 'salary':
      return { color: '#3b82f6', label: 'typeSalary' };
    case 'bonus':
      return { color: '#7c3aed', label: 'typeBonus' };
    default:
      return { color: '#6b7280', label: 'typeNormal' };
  }
}
