import {
  sanitizeText,
  isValidAmount,
  isValidApprovalStatus,
  isValidObjectId,
  isPositiveAmount,
} from '../sanitize';
import { FILTER_MAX_LENGTH } from '@/types/shared';

describe('sanitizeText', () => {
  it('trims whitespace from both ends', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('caps length at FILTER_MAX_LENGTH by default', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeText(long)).toHaveLength(FILTER_MAX_LENGTH);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    expect(sanitizeText('   ')).toBe('');
  });

  it('accepts custom maxLength parameter', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeText(long, 1000)).toHaveLength(1000);
  });

  it('preserves strings within length limit', () => {
    expect(sanitizeText('normal text')).toBe('normal text');
  });
});

describe('isValidAmount', () => {
  it('returns true for empty string', () => {
    expect(isValidAmount('')).toBe(true);
  });

  it('returns true for positive integer', () => {
    expect(isValidAmount('100')).toBe(true);
  });

  it('returns true for negative integer', () => {
    expect(isValidAmount('-50')).toBe(true);
  });

  it('returns true for decimal with two places', () => {
    expect(isValidAmount('99.50')).toBe(true);
  });

  it('returns false for decimal with three places', () => {
    expect(isValidAmount('99.501')).toBe(false);
  });

  it('returns false for non-numeric string', () => {
    expect(isValidAmount('abc')).toBe(false);
  });

  it('returns true for amount with leading spaces (trimmed)', () => {
    expect(isValidAmount('  100  ')).toBe(true);
  });

  it('returns false for double negative', () => {
    expect(isValidAmount('--50')).toBe(false);
  });
});

describe('isValidApprovalStatus', () => {
  it('returns true for null (no filter)', () => {
    expect(isValidApprovalStatus(null)).toBe(true);
  });

  it('returns true for each valid status', () => {
    expect(isValidApprovalStatus('Pending')).toBe(true);
    expect(isValidApprovalStatus('Approved')).toBe(true);
    expect(isValidApprovalStatus('Rejected')).toBe(true);
  });

  it('returns false for lowercase variant', () => {
    expect(isValidApprovalStatus('pending')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidApprovalStatus('Invalid')).toBe(false);
  });
});

describe('isValidObjectId', () => {
  it('returns true for valid 24-char hex', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('returns true for uppercase hex', () => {
    expect(isValidObjectId('507F1F77BCF86CD799439011')).toBe(true);
  });

  it('returns true for null (optional field)', () => {
    expect(isValidObjectId(null)).toBe(true);
  });

  it('returns true for empty string (optional field)', () => {
    expect(isValidObjectId('')).toBe(true);
  });

  it('returns false for 23-char string', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false);
  });

  it('returns false for non-hex characters', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false);
  });

  it('returns false for injection attempt', () => {
    expect(isValidObjectId("'; DROP TABLE users; --")).toBe(false);
  });
});

describe('isPositiveAmount', () => {
  it('returns true for a positive integer string', () => {
    expect(isPositiveAmount('5')).toBe(true);
  });

  it('returns true for a positive decimal string', () => {
    expect(isPositiveAmount('0.5')).toBe(true);
  });

  it('returns false for "0"', () => {
    expect(isPositiveAmount('0')).toBe(false);
  });

  it('returns false for "0.00"', () => {
    expect(isPositiveAmount('0.00')).toBe(false);
  });

  it('returns false for empty / whitespace', () => {
    expect(isPositiveAmount('')).toBe(false);
    expect(isPositiveAmount('   ')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPositiveAmount(null)).toBe(false);
    expect(isPositiveAmount(undefined)).toBe(false);
  });

  it('returns false for non-numeric input', () => {
    expect(isPositiveAmount('abc')).toBe(false);
  });

  it('returns false for negative amounts', () => {
    expect(isPositiveAmount('-5')).toBe(false);
  });
});
