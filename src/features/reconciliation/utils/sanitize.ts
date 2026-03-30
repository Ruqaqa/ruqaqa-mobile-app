import { ReconciliationFilters, RECONCILIATION_TYPES, ReconciliationType, ENTITY_TYPES, EntityType } from '../types';

export { sanitizeText, isValidAmount, isValidApprovalStatus, isValidObjectId } from '@/utils/sanitize';
import { sanitizeText, isValidAmount, isValidApprovalStatus, isValidObjectId } from '@/utils/sanitize';

/** Validate reconciliation type against the enum */
export function isValidReconciliationType(
  value: string | null,
): value is ReconciliationType {
  if (value === null) return true;
  return (RECONCILIATION_TYPES as readonly string[]).includes(value);
}

/** Validate entity type (sender/receiver party type) against the enum */
export function isValidEntityType(
  value: string | null,
): value is EntityType {
  if (value === null) return true;
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

/** Sanitize all filters before sending to API */
export function sanitizeFilters(filters: ReconciliationFilters): ReconciliationFilters {
  return {
    statement: sanitizeText(filters.statement),
    reconciliationNumber: sanitizeText(filters.reconciliationNumber),
    fromEmployee: filters.fromType === 'employee' ? sanitizeText(filters.fromEmployee) : '',
    toEmployee: filters.toType === 'employee' ? sanitizeText(filters.toEmployee) : '',
    amountMin: isValidAmount(filters.amountMin) ? filters.amountMin.trim() : '',
    amountMax: isValidAmount(filters.amountMax) ? filters.amountMax.trim() : '',
    type: isValidReconciliationType(filters.type) ? filters.type : null,
    fromType: isValidEntityType(filters.fromType) ? filters.fromType : null,
    toType: isValidEntityType(filters.toType) ? filters.toType : null,
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
    filters.fromEmployee !== '' ||
    filters.toEmployee !== '' ||
    filters.amountMin !== '' ||
    filters.amountMax !== '' ||
    filters.type !== null ||
    filters.fromType !== null ||
    filters.toType !== null ||
    filters.senderChannel !== '' ||
    filters.receiverChannel !== '' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.approvalStatus !== null
  );
}
