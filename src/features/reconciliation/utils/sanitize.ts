import { ReconciliationFilters, RECONCILIATION_TYPES, ReconciliationType } from '../types';

export { sanitizeText, isValidAmount, isValidApprovalStatus, isValidObjectId } from '@/utils/sanitize';
import { sanitizeText, isValidAmount, isValidApprovalStatus, isValidObjectId } from '@/utils/sanitize';

/** Validate reconciliation type against the enum */
export function isValidReconciliationType(
  value: string | null,
): value is ReconciliationType {
  if (value === null) return true;
  return (RECONCILIATION_TYPES as readonly string[]).includes(value);
}

/** Sanitize all filters before sending to API */
export function sanitizeFilters(filters: ReconciliationFilters): ReconciliationFilters {
  return {
    statement: sanitizeText(filters.statement),
    reconciliationNumber: sanitizeText(filters.reconciliationNumber),
    employee: sanitizeText(filters.employee),
    amount: isValidAmount(filters.amount) ? filters.amount.trim() : '',
    type: isValidReconciliationType(filters.type) ? filters.type : null,
    senderChannel: isValidObjectId(filters.senderChannel) && filters.senderChannel !== '' ? filters.senderChannel : '',
    receiverChannel: isValidObjectId(filters.receiverChannel) && filters.receiverChannel !== '' ? filters.receiverChannel : '',
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    approvalStatus: isValidApprovalStatus(filters.approvalStatus)
      ? filters.approvalStatus
      : null,
  };
}

/** Check if any filter is active */
export function hasActiveFilters(filters: ReconciliationFilters): boolean {
  return (
    filters.statement !== '' ||
    filters.reconciliationNumber !== '' ||
    filters.employee !== '' ||
    filters.amount !== '' ||
    filters.type !== null ||
    filters.senderChannel !== '' ||
    filters.receiverChannel !== '' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.approvalStatus !== null
  );
}
