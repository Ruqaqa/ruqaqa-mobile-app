import { APPROVAL_STATUSES, FILTER_MAX_LENGTH, CURRENCIES } from '@/types/shared';
import type { Currency } from '@/types/shared';

// ---------------------------------------------------------------------------
// Text sanitization
// ---------------------------------------------------------------------------

/** Trim and cap a string input. Defaults to FILTER_MAX_LENGTH (200). */
export function sanitizeText(
  value: string,
  maxLength: number = FILTER_MAX_LENGTH,
): string {
  return (value ?? '').trim().slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Amount validation
// ---------------------------------------------------------------------------

/** Validate amount for filter inputs (allows negative, 2 decimal places max). */
export function isValidAmount(value: string): boolean {
  if (value === '') return true;
  return /^-?\d+(\.\d{1,2})?$/.test(value.trim());
}

// ---------------------------------------------------------------------------
// Enum validators
// ---------------------------------------------------------------------------

/** Validate approval status against the enum */
export function isValidApprovalStatus(
  value: string | null,
): value is (typeof APPROVAL_STATUSES)[number] {
  if (value === null) return true;
  return (APPROVAL_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Submission amount validation
// ---------------------------------------------------------------------------

/** Validate amount for submission (positive only, 2 decimal places max). */
export function isValidSubmissionAmount(value: string): boolean {
  if (value === '') return false;
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

/** Validate currency against the allowed list */
export function isValidCurrency(value: string | null): value is Currency {
  if (value === null) return false;
  return (CURRENCIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// ID validation
// ---------------------------------------------------------------------------

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Validate a MongoDB ObjectId format. Null/empty is allowed (optional field). */
export function isValidObjectId(value: string | null | undefined): boolean {
  if (value == null || value === '') return true;
  return OBJECT_ID_RE.test(value);
}
