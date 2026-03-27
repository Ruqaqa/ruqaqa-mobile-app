import {
  sanitizeText,
  isValidAmount,
  isValidApprovalStatus,
  isValidTaxQuarter,
  isValidTaxYear,
  sanitizeFilters,
  hasActiveFilters,
} from '../utils/sanitize';
import { EMPTY_FILTERS, FILTER_MAX_LENGTH, TransactionFilters } from '../types';

describe('sanitizeText', () => {
  it('trims whitespace from both ends', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('caps length at FILTER_MAX_LENGTH', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeText(long)).toHaveLength(FILTER_MAX_LENGTH);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    expect(sanitizeText('   ')).toBe('');
  });

  it('preserves strings within length limit', () => {
    expect(sanitizeText('normal text')).toBe('normal text');
  });

  it('handles SQL-injection-like strings by trimming only', () => {
    const input = "'; DROP TABLE transactions; --";
    expect(sanitizeText(input)).toBe(input);
  });

  it('handles XSS-like strings by trimming only', () => {
    const input = '<script>alert("xss")</script>';
    expect(sanitizeText(input)).toBe(input);
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

  it('returns true for decimal with one place', () => {
    expect(isValidAmount('99.5')).toBe(true);
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

  it('returns false for mixed alphanumeric', () => {
    expect(isValidAmount('12abc')).toBe(false);
  });

  it('returns true for amount with leading spaces (trimmed)', () => {
    expect(isValidAmount('  100  ')).toBe(true);
  });

  it('returns false for double negative', () => {
    expect(isValidAmount('--50')).toBe(false);
  });

  it('returns false for multiple dots', () => {
    expect(isValidAmount('1.2.3')).toBe(false);
  });
});

describe('isValidApprovalStatus', () => {
  it('returns true for null (no filter)', () => {
    expect(isValidApprovalStatus(null)).toBe(true);
  });

  it('returns true for Pending', () => {
    expect(isValidApprovalStatus('Pending')).toBe(true);
  });

  it('returns true for Approved', () => {
    expect(isValidApprovalStatus('Approved')).toBe(true);
  });

  it('returns true for Rejected', () => {
    expect(isValidApprovalStatus('Rejected')).toBe(true);
  });

  it('returns false for lowercase variant', () => {
    expect(isValidApprovalStatus('pending')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidApprovalStatus('Invalid')).toBe(false);
  });
});

describe('isValidTaxQuarter', () => {
  it('returns true for null', () => {
    expect(isValidTaxQuarter(null)).toBe(true);
  });

  it('returns true for Q1', () => {
    expect(isValidTaxQuarter('Q1')).toBe(true);
  });

  it('returns true for Q4', () => {
    expect(isValidTaxQuarter('Q4')).toBe(true);
  });

  it('returns false for lowercase q1', () => {
    expect(isValidTaxQuarter('q1')).toBe(false);
  });

  it('returns false for Q5', () => {
    expect(isValidTaxQuarter('Q5')).toBe(false);
  });
});

describe('isValidTaxYear', () => {
  it('returns true for null', () => {
    expect(isValidTaxYear(null)).toBe(true);
  });

  it('returns true for 2024', () => {
    expect(isValidTaxYear('2024')).toBe(true);
  });

  it('returns true for 2027', () => {
    expect(isValidTaxYear('2027')).toBe(true);
  });

  it('returns false for 2023', () => {
    expect(isValidTaxYear('2023')).toBe(false);
  });

  it('returns false for 2028', () => {
    expect(isValidTaxYear('2028')).toBe(false);
  });
});

describe('sanitizeFilters', () => {
  it('returns EMPTY_FILTERS for empty input', () => {
    expect(sanitizeFilters(EMPTY_FILTERS)).toEqual(EMPTY_FILTERS);
  });

  it('trims text fields including partnerEmployee and otherParty', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      statement: '  rent payment  ',
      client: '  Acme Corp  ',
      partnerEmployee: '  John Doe  ',
      otherParty: '  Some Company  ',
    };
    const result = sanitizeFilters(filters);
    expect(result.statement).toBe('rent payment');
    expect(result.client).toBe('Acme Corp');
    expect(result.partnerEmployee).toBe('John Doe');
    expect(result.otherParty).toBe('Some Company');
  });

  it('drops invalid amountMin', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      amountMin: 'not-a-number',
    };
    expect(sanitizeFilters(filters).amountMin).toBe('');
  });

  it('keeps valid amountMin and amountMax', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      amountMin: '100',
      amountMax: '500.50',
    };
    const result = sanitizeFilters(filters);
    expect(result.amountMin).toBe('100');
    expect(result.amountMax).toBe('500.50');
  });

  it('does not include amountSign in sanitized output', () => {
    const result = sanitizeFilters(EMPTY_FILTERS);
    expect(result).not.toHaveProperty('amountSign');
  });

  it('drops invalid taxQuarter', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      taxQuarter: 'Q5' as any,
    };
    expect(sanitizeFilters(filters).taxQuarter).toBeNull();
  });

  it('keeps valid taxQuarter', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      taxQuarter: 'Q2',
    };
    expect(sanitizeFilters(filters).taxQuarter).toBe('Q2');
  });

  it('drops invalid taxYear', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      taxYear: '2023' as any,
    };
    expect(sanitizeFilters(filters).taxYear).toBeNull();
  });

  it('keeps valid taxYear', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      taxYear: '2025',
    };
    expect(sanitizeFilters(filters).taxYear).toBe('2025');
  });

  it('drops invalid approval status', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      approvalStatus: 'BadStatus' as any,
    };
    expect(sanitizeFilters(filters).approvalStatus).toBeNull();
  });

  it('keeps valid approval status', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      approvalStatus: 'Approved',
    };
    expect(sanitizeFilters(filters).approvalStatus).toBe('Approved');
  });

  it('preserves date fields as-is', () => {
    const d = new Date('2025-01-15');
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      dateFrom: d,
    };
    expect(sanitizeFilters(filters).dateFrom).toBe(d);
  });
});

describe('hasActiveFilters', () => {
  it('returns false for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('returns true when statement is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, statement: 'rent' })).toBe(true);
  });

  it('returns true when partnerEmployee is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, partnerEmployee: 'John' })).toBe(true);
  });

  it('returns true when otherParty is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, otherParty: 'Vendor' })).toBe(true);
  });

  it('returns true when dateFrom is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateFrom: new Date() })).toBe(true);
  });

  it('returns true when approvalStatus is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, approvalStatus: 'Pending' })).toBe(true);
  });

  it('returns true when amountMin is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amountMin: '100' })).toBe(true);
  });

  it('returns true when amountMax is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amountMax: '500' })).toBe(true);
  });

  it('returns true when taxQuarter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, taxQuarter: 'Q1' })).toBe(true);
  });

  it('returns true when taxYear is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, taxYear: '2025' })).toBe(true);
  });
});
