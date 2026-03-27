import {
  TransactionFilters,
  FILTER_MAX_LENGTH,
  APPROVAL_STATUSES,
  ApprovalStatus,
  TAX_QUARTERS,
  TaxQuarter,
  TAX_YEARS,
  TaxYear,
} from '../types';

/** Trim and cap a string input */
export function sanitizeText(value: string): string {
  return value.trim().slice(0, FILTER_MAX_LENGTH);
}

/** Validate that a string is a valid numeric amount (or empty) */
export function isValidAmount(value: string): boolean {
  if (value === '') return true;
  return /^-?\d+(\.\d{1,2})?$/.test(value.trim());
}

/** Validate approval status against the enum */
export function isValidApprovalStatus(
  value: string | null,
): value is ApprovalStatus {
  if (value === null) return true;
  return (APPROVAL_STATUSES as readonly string[]).includes(value);
}

/** Validate tax quarter against the enum */
export function isValidTaxQuarter(value: string | null): value is TaxQuarter {
  if (value === null) return true;
  return (TAX_QUARTERS as readonly string[]).includes(value);
}

/** Validate tax year against the enum */
export function isValidTaxYear(value: string | null): value is TaxYear {
  if (value === null) return true;
  return (TAX_YEARS as readonly string[]).includes(value);
}

/** Sanitize all filters before sending to API */
export function sanitizeFilters(filters: TransactionFilters): TransactionFilters {
  return {
    statement: sanitizeText(filters.statement),
    transactionNumber: sanitizeText(filters.transactionNumber),
    partnerEmployee: sanitizeText(filters.partnerEmployee),
    otherParty: sanitizeText(filters.otherParty),
    client: sanitizeText(filters.client),
    project: sanitizeText(filters.project),
    amountMin: isValidAmount(filters.amountMin) ? filters.amountMin.trim() : '',
    amountMax: isValidAmount(filters.amountMax) ? filters.amountMax.trim() : '',
    taxQuarter: isValidTaxQuarter(filters.taxQuarter) ? filters.taxQuarter : null,
    taxYear: isValidTaxYear(filters.taxYear) ? filters.taxYear : null,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    approvalStatus: isValidApprovalStatus(filters.approvalStatus)
      ? filters.approvalStatus
      : null,
  };
}

/** Check if any filter is active */
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.statement !== '' ||
    filters.transactionNumber !== '' ||
    filters.partnerEmployee !== '' ||
    filters.otherParty !== '' ||
    filters.client !== '' ||
    filters.project !== '' ||
    filters.amountMin !== '' ||
    filters.amountMax !== '' ||
    filters.taxQuarter !== null ||
    filters.taxYear !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.approvalStatus !== null
  );
}
