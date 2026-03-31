import {
  TransactionFilters,
  NOTES_MAX_LENGTH,
  TAX_QUARTERS,
  TaxQuarter,
  TAX_YEARS,
  TaxYear,
  PARTNER_TYPES,
  PartnerType,
  WALLET_PARTNER,
  BALAD_CARD_PARTNER,
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE,
  TransactionSubmissionData,
} from '../types';

// Re-export shared sanitizers so existing imports from this module keep working
export { sanitizeText, isValidAmount, isValidApprovalStatus, isValidObjectId, isValidSubmissionAmount, isValidCurrency } from '@/utils/sanitize';
import { sanitizeText } from '@/utils/sanitize';
import { isValidAmount } from '@/utils/sanitize';
import { isValidApprovalStatus } from '@/utils/sanitize';

/** Trim and cap a notes field (1000 chars). */
export function sanitizeNotes(value: string): string {
  return sanitizeText(value, NOTES_MAX_LENGTH);
}

// isValidSubmissionAmount re-exported from @/utils/sanitize above

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

// isValidCurrency re-exported from @/utils/sanitize above

/** Validate partner type against the allowed list */
export function isValidPartnerType(
  value: string | null,
): value is PartnerType {
  if (value === null) return true;
  return (PARTNER_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Partner filter validation
// ---------------------------------------------------------------------------

const VALID_PARTNER_CONSTANTS = [WALLET_PARTNER, BALAD_CARD_PARTNER] as const;

/** Validate that a partner filter value is empty, a valid ObjectId, or a known partner constant. */
export function isValidPartnerFilter(value: string): boolean {
  if (value === '') return true;
  if ((VALID_PARTNER_CONSTANTS as readonly string[]).includes(value)) return true;
  return /^[a-f\d]{24}$/i.test(value);
}

// ---------------------------------------------------------------------------
// File upload validation
// ---------------------------------------------------------------------------

/** Strip path separators and null bytes from filenames */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\\0]/g, '_');
}

/** Check if a MIME type is in the receipt upload whitelist */
export function isAllowedMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return (ALLOWED_RECEIPT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Check if a file size (in bytes) is within the upload limit */
export function isWithinSizeLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_RECEIPT_FILE_SIZE;
}

// ---------------------------------------------------------------------------
// Filter sanitization (search/list screens)
// ---------------------------------------------------------------------------

/** Sanitize all filters before sending to API */
export function sanitizeFilters(filters: TransactionFilters): TransactionFilters {
  return {
    statement: sanitizeText(filters.statement),
    transactionNumber: sanitizeText(filters.transactionNumber),
    partnerEmployee: isValidPartnerFilter(filters.partnerEmployee) ? filters.partnerEmployee : '',
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

// ---------------------------------------------------------------------------
// Submission data sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize all text fields in submission data before building FormData.
 * This applies trim + length caps to free-text fields while leaving
 * enum/ID/file fields untouched (those are validated separately).
 * bankFees stays as a string — it is parsed to a number only at final FormData build time.
 */
export function sanitizeSubmissionData(
  data: TransactionSubmissionData,
): TransactionSubmissionData {
  return {
    ...data,
    statement: sanitizeText(data.statement),
    totalAmount: data.totalAmount.trim(),
    otherParty: data.otherParty ? sanitizeText(data.otherParty) : null,
    notes: data.notes ? sanitizeNotes(data.notes) : null,
  };
}
