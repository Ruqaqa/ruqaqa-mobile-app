import {
  sanitizeText,
  sanitizeNotes,
  isValidAmount,
  isValidSubmissionAmount,
  isValidApprovalStatus,
  isValidTaxQuarter,
  isValidTaxYear,
  isValidCurrency,
  isValidPartnerType,
  isValidObjectId,
  isValidPartnerFilter,
  sanitizeFilename,
  isAllowedMimeType,
  isWithinSizeLimit,
  sanitizeFilters,
  hasActiveFilters,
  sanitizeSubmissionData,
} from '../utils/sanitize';
import { TransactionSubmissionData } from '../services/transactionSubmissionService';
import {
  EMPTY_FILTERS,
  FILTER_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  MAX_RECEIPT_FILE_SIZE,
  WALLET_PARTNER,
  BALAD_CARD_PARTNER,
  TransactionFilters,
} from '../types';

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

  it('accepts custom maxLength parameter', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeText(long, 1000)).toHaveLength(1000);
  });

  it('custom maxLength does not affect short strings', () => {
    expect(sanitizeText('hello', 1000)).toBe('hello');
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

  it('trims text fields and resets invalid partnerEmployee', () => {
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
    expect(result.partnerEmployee).toBe('');  // free text is invalid
    expect(result.otherParty).toBe('Some Company');
  });

  it('passes through valid ObjectId for partnerEmployee', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      partnerEmployee: '507f1f77bcf86cd799439011',
    };
    expect(sanitizeFilters(filters).partnerEmployee).toBe('507f1f77bcf86cd799439011');
  });

  it('passes through WALLET_PARTNER constant for partnerEmployee', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      partnerEmployee: WALLET_PARTNER,
    };
    expect(sanitizeFilters(filters).partnerEmployee).toBe(WALLET_PARTNER);
  });

  it('passes through BALAD_CARD_PARTNER constant for partnerEmployee', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      partnerEmployee: BALAD_CARD_PARTNER,
    };
    expect(sanitizeFilters(filters).partnerEmployee).toBe(BALAD_CARD_PARTNER);
  });

  it('resets arbitrary text partnerEmployee to empty string', () => {
    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      partnerEmployee: 'some random text',
    };
    expect(sanitizeFilters(filters).partnerEmployee).toBe('');
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

// ---------------------------------------------------------------------------
// Security validation tests
// ---------------------------------------------------------------------------

describe('sanitizeNotes', () => {
  it('trims and caps at NOTES_MAX_LENGTH (1000)', () => {
    const long = '  ' + 'x'.repeat(1100) + '  ';
    const result = sanitizeNotes(long);
    expect(result).toHaveLength(NOTES_MAX_LENGTH);
    expect(result.startsWith('x')).toBe(true);
  });

  it('preserves short notes', () => {
    expect(sanitizeNotes('short note')).toBe('short note');
  });
});

describe('isValidSubmissionAmount', () => {
  it('returns false for empty string', () => {
    expect(isValidSubmissionAmount('')).toBe(false);
  });

  it('returns true for positive integer', () => {
    expect(isValidSubmissionAmount('500')).toBe(true);
  });

  it('returns true for decimal with two places', () => {
    expect(isValidSubmissionAmount('99.50')).toBe(true);
  });

  it('returns false for negative amount', () => {
    expect(isValidSubmissionAmount('-100')).toBe(false);
  });

  it('returns false for three decimal places', () => {
    expect(isValidSubmissionAmount('99.501')).toBe(false);
  });

  it('returns false for non-numeric', () => {
    expect(isValidSubmissionAmount('abc')).toBe(false);
  });

  it('returns false for eval-like string', () => {
    expect(isValidSubmissionAmount('1+1')).toBe(false);
  });

  it('returns false for scientific notation', () => {
    expect(isValidSubmissionAmount('1e5')).toBe(false);
  });

  it('returns false for scientific notation with decimal', () => {
    expect(isValidSubmissionAmount('1.5e2')).toBe(false);
  });
});

describe('isValidCurrency', () => {
  it('returns true for Saudi Riyal', () => {
    expect(isValidCurrency('ريال سعودي')).toBe(true);
  });

  it('returns true for US Dollar', () => {
    expect(isValidCurrency('دولار أمريكي')).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidCurrency(null)).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidCurrency('Bitcoin')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidCurrency('')).toBe(false);
  });
});

describe('isValidPartnerType', () => {
  it('returns true for employee', () => {
    expect(isValidPartnerType('employee')).toBe(true);
  });

  it('returns true for wallet', () => {
    expect(isValidPartnerType('wallet')).toBe(true);
  });

  it('returns true for null (optional)', () => {
    expect(isValidPartnerType(null)).toBe(true);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidPartnerType('admin')).toBe(false);
  });
});

describe('isValidPartnerFilter', () => {
  it('returns true for empty string', () => {
    expect(isValidPartnerFilter('')).toBe(true);
  });

  it('returns true for valid ObjectId', () => {
    expect(isValidPartnerFilter('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('returns true for WALLET_PARTNER constant', () => {
    expect(isValidPartnerFilter(WALLET_PARTNER)).toBe(true);
  });

  it('returns true for BALAD_CARD_PARTNER constant', () => {
    expect(isValidPartnerFilter(BALAD_CARD_PARTNER)).toBe(true);
  });

  it('returns false for arbitrary text', () => {
    expect(isValidPartnerFilter('John Doe')).toBe(false);
  });

  it('returns false for short hex string', () => {
    expect(isValidPartnerFilter('507f1f77')).toBe(false);
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

  it('returns false for 25-char string', () => {
    expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false);
  });

  it('returns false for non-hex characters', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false);
  });

  it('returns false for injection attempt', () => {
    expect(isValidObjectId("'; DROP TABLE users; --")).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('replaces forward slashes with underscores', () => {
    expect(sanitizeFilename('path/to/file.jpg')).toBe('path_to_file.jpg');
  });

  it('replaces backslashes with underscores', () => {
    expect(sanitizeFilename('path\\to\\file.jpg')).toBe('path_to_file.jpg');
  });

  it('replaces null bytes with underscores', () => {
    expect(sanitizeFilename('file\0name.jpg')).toBe('file_name.jpg');
  });

  it('handles mixed separators', () => {
    expect(sanitizeFilename('a/b\\c\0d.pdf')).toBe('a_b_c_d.pdf');
  });

  it('preserves clean filenames', () => {
    expect(sanitizeFilename('receipt-2026.jpg')).toBe('receipt-2026.jpg');
  });
});

describe('isAllowedMimeType', () => {
  it('allows image/jpeg', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
  });

  it('allows image/png', () => {
    expect(isAllowedMimeType('image/png')).toBe(true);
  });

  it('allows image/heic', () => {
    expect(isAllowedMimeType('image/heic')).toBe(true);
  });

  it('allows image/webp', () => {
    expect(isAllowedMimeType('image/webp')).toBe(true);
  });

  it('allows application/pdf', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('rejects image/gif', () => {
    expect(isAllowedMimeType('image/gif')).toBe(false);
  });

  it('rejects application/javascript', () => {
    expect(isAllowedMimeType('application/javascript')).toBe(false);
  });

  it('rejects text/html', () => {
    expect(isAllowedMimeType('text/html')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isAllowedMimeType(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedMimeType('')).toBe(false);
  });
});

describe('isWithinSizeLimit', () => {
  it('returns true for 1 byte', () => {
    expect(isWithinSizeLimit(1)).toBe(true);
  });

  it('returns true for exactly 10MB', () => {
    expect(isWithinSizeLimit(MAX_RECEIPT_FILE_SIZE)).toBe(true);
  });

  it('returns false for 10MB + 1 byte', () => {
    expect(isWithinSizeLimit(MAX_RECEIPT_FILE_SIZE + 1)).toBe(false);
  });

  it('returns false for 0 bytes', () => {
    expect(isWithinSizeLimit(0)).toBe(false);
  });

  it('returns false for negative bytes', () => {
    expect(isWithinSizeLimit(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeSubmissionData — applies all sanitization rules to submission data
// ---------------------------------------------------------------------------

const VALID_ID = 'aabbccddeeff00112233aabb';

function makeRawSubmission(
  overrides: Partial<TransactionSubmissionData> = {},
): TransactionSubmissionData {
  return {
    statement: 'Office supplies',
    totalAmount: '500',
    currency: 'ريال سعودي',
    tax: 'لا',
    transactionDate: '03/27/2026',
    partnerEmployee: VALID_ID,
    otherParty: 'Vendor Corp',
    otherPartyType: 'text',
    otherPartyId: null,
    client: VALID_ID,
    project: VALID_ID,
    notes: 'Some notes',
    bankFees: '25',
    bankFeesCurrency: 'ريال سعودي',
    receipts: [],
    ...overrides,
  };
}

describe('sanitizeSubmissionData', () => {
  it('trims statement whitespace', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ statement: '  Office supplies  ' }),
    );
    expect(result.statement).toBe('Office supplies');
  });

  it('caps statement at FILTER_MAX_LENGTH (200)', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ statement: 'x'.repeat(300) }),
    );
    expect(result.statement).toHaveLength(FILTER_MAX_LENGTH);
  });

  it('trims and caps notes at NOTES_MAX_LENGTH (1000)', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ notes: '  ' + 'n'.repeat(1500) + '  ' }),
    );
    expect(result.notes).toHaveLength(NOTES_MAX_LENGTH);
    expect(result.notes!.startsWith('n')).toBe(true);
  });

  it('trims otherParty', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ otherParty: '  Vendor Corp  ' }),
    );
    expect(result.otherParty).toBe('Vendor Corp');
  });

  it('preserves null otherParty', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ otherParty: null }),
    );
    expect(result.otherParty).toBeNull();
  });

  it('trims totalAmount', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ totalAmount: '  500.50  ' }),
    );
    expect(result.totalAmount).toBe('500.50');
  });

  it('keeps bankFees as string (not parsed to number)', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ bankFees: '25.50' }),
    );
    expect(typeof result.bankFees).toBe('string');
    expect(result.bankFees).toBe('25.50');
  });

  it('preserves null bankFees', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ bankFees: null }),
    );
    expect(result.bankFees).toBeNull();
  });

  it('passes through currency unchanged (validation is separate)', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({ currency: 'ريال سعودي' }),
    );
    expect(result.currency).toBe('ريال سعودي');
  });

  it('passes through ID fields unchanged (validation is separate)', () => {
    const result = sanitizeSubmissionData(
      makeRawSubmission({
        partnerEmployee: VALID_ID,
        client: VALID_ID,
        project: VALID_ID,
      }),
    );
    expect(result.partnerEmployee).toBe(VALID_ID);
    expect(result.client).toBe(VALID_ID);
    expect(result.project).toBe(VALID_ID);
  });

  it('preserves receipts array reference', () => {
    const files = [new File(['a'], 'test.jpg', { type: 'image/jpeg' })];
    const result = sanitizeSubmissionData(
      makeRawSubmission({ receipts: files }),
    );
    expect(result.receipts).toBe(files);
  });
});
