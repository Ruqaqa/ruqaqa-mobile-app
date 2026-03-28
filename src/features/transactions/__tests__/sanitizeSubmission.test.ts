/**
 * Focused tests for security validators used in transaction submission.
 * These validate sanitize.ts functions that gate what goes into the API payload.
 */
import {
  isValidSubmissionAmount,
  isValidObjectId,
  isValidCurrency,
  isValidPartnerType,
  sanitizeFilename,
  isAllowedMimeType,
  isWithinSizeLimit,
  sanitizeText,
} from '../utils/sanitize';
import {
  FILTER_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  MAX_RECEIPT_FILE_SIZE,
} from '../types';

// ---------------------------------------------------------------------------
// 1. isValidSubmissionAmount — positive only, max 2 decimals, no science
// ---------------------------------------------------------------------------
describe('isValidSubmissionAmount', () => {
  // Accepted values
  it('accepts "0.01"', () => {
    expect(isValidSubmissionAmount('0.01')).toBe(true);
  });

  it('accepts "100"', () => {
    expect(isValidSubmissionAmount('100')).toBe(true);
  });

  it('accepts "99.99"', () => {
    expect(isValidSubmissionAmount('99.99')).toBe(true);
  });

  it('accepts "0"', () => {
    expect(isValidSubmissionAmount('0')).toBe(true);
  });

  it('accepts single decimal place "5.5"', () => {
    expect(isValidSubmissionAmount('5.5')).toBe(true);
  });

  it('accepts large number "999999"', () => {
    expect(isValidSubmissionAmount('999999')).toBe(true);
  });

  // Rejected values
  it('rejects empty string', () => {
    expect(isValidSubmissionAmount('')).toBe(false);
  });

  it('rejects negative "-100"', () => {
    expect(isValidSubmissionAmount('-100')).toBe(false);
  });

  it('rejects negative decimal "-0.50"', () => {
    expect(isValidSubmissionAmount('-0.50')).toBe(false);
  });

  it('rejects scientific notation "1e5"', () => {
    expect(isValidSubmissionAmount('1e5')).toBe(false);
  });

  it('rejects scientific notation "1.5e2"', () => {
    expect(isValidSubmissionAmount('1.5e2')).toBe(false);
  });

  it('rejects three decimal places "99.501"', () => {
    expect(isValidSubmissionAmount('99.501')).toBe(false);
  });

  it('rejects non-numeric "abc"', () => {
    expect(isValidSubmissionAmount('abc')).toBe(false);
  });

  it('rejects expression "1+1"', () => {
    expect(isValidSubmissionAmount('1+1')).toBe(false);
  });

  it('rejects leading dot ".99"', () => {
    expect(isValidSubmissionAmount('.99')).toBe(false);
  });

  it('rejects trailing dot "99."', () => {
    expect(isValidSubmissionAmount('99.')).toBe(false);
  });

  it('rejects spaces in middle "1 00"', () => {
    expect(isValidSubmissionAmount('1 00')).toBe(false);
  });

  it('accepts value with surrounding whitespace (trimmed) "  100  "', () => {
    expect(isValidSubmissionAmount('  100  ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. isValidObjectId — must match /^[a-f\d]{24}$/i
// ---------------------------------------------------------------------------
describe('isValidObjectId', () => {
  it('accepts valid 24-char lowercase hex', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
  });

  it('accepts valid 24-char uppercase hex', () => {
    expect(isValidObjectId('507F1F77BCF86CD799439011')).toBe(true);
  });

  it('accepts valid 24-char mixed case hex', () => {
    expect(isValidObjectId('aaBBccDDeeFF001122334455')).toBe(true);
  });

  it('accepts null (optional field)', () => {
    expect(isValidObjectId(null)).toBe(true);
  });

  it('accepts undefined (optional field)', () => {
    expect(isValidObjectId(undefined)).toBe(true);
  });

  it('accepts empty string (optional field)', () => {
    expect(isValidObjectId('')).toBe(true);
  });

  it('rejects 23-char string (too short)', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901')).toBe(false);
  });

  it('rejects 25-char string (too long)', () => {
    expect(isValidObjectId('507f1f77bcf86cd7994390111')).toBe(false);
  });

  it('rejects non-hex character "g"', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901g')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439$11')).toBe(false);
  });

  it('rejects SQL injection attempt', () => {
    expect(isValidObjectId("'; DROP TABLE users; --")).toBe(false);
  });

  it('rejects string with spaces', () => {
    expect(isValidObjectId('507f1f77 bcf86cd79943901')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. isValidCurrency — only accepts values in CURRENCIES array
// ---------------------------------------------------------------------------
describe('isValidCurrency', () => {
  it('accepts "ريال سعودي"', () => {
    expect(isValidCurrency('ريال سعودي')).toBe(true);
  });

  it('accepts "دولار أمريكي"', () => {
    expect(isValidCurrency('دولار أمريكي')).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidCurrency(null)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidCurrency('')).toBe(false);
  });

  it('rejects "Bitcoin"', () => {
    expect(isValidCurrency('Bitcoin')).toBe(false);
  });

  it('rejects "USD" (must be Arabic name)', () => {
    expect(isValidCurrency('USD')).toBe(false);
  });

  it('rejects "SAR" (must be Arabic name)', () => {
    expect(isValidCurrency('SAR')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. isValidPartnerType — only accepts values in PARTNER_TYPES array
// ---------------------------------------------------------------------------
describe('isValidPartnerType', () => {
  it('accepts "employee"', () => {
    expect(isValidPartnerType('employee')).toBe(true);
  });

  it('accepts "wallet"', () => {
    expect(isValidPartnerType('wallet')).toBe(true);
  });

  it('accepts null (optional)', () => {
    expect(isValidPartnerType(null)).toBe(true);
  });

  it('rejects "admin"', () => {
    expect(isValidPartnerType('admin')).toBe(false);
  });

  it('rejects "Employee" (case-sensitive)', () => {
    expect(isValidPartnerType('Employee')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPartnerType('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. sanitizeFilename — strips /, \, null bytes
// ---------------------------------------------------------------------------
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

  it('handles path traversal attempt', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('.._.._.._etc_passwd');
  });

  it('handles Windows path traversal', () => {
    expect(sanitizeFilename('..\\..\\Windows\\System32')).toBe(
      '.._.._Windows_System32',
    );
  });

  it('preserves normal filenames', () => {
    expect(sanitizeFilename('receipt-2026.jpg')).toBe('receipt-2026.jpg');
  });

  it('preserves filenames with dots and dashes', () => {
    expect(sanitizeFilename('my.file-name_v2.pdf')).toBe('my.file-name_v2.pdf');
  });

  it('preserves Arabic filenames', () => {
    expect(sanitizeFilename('إيصال.jpg')).toBe('إيصال.jpg');
  });
});

// ---------------------------------------------------------------------------
// 6. isAllowedMimeType — whitelist check
// ---------------------------------------------------------------------------
describe('isAllowedMimeType', () => {
  // Accepted
  it('accepts image/jpeg', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
  });

  it('accepts image/png', () => {
    expect(isAllowedMimeType('image/png')).toBe(true);
  });

  it('accepts image/heic', () => {
    expect(isAllowedMimeType('image/heic')).toBe(true);
  });

  it('accepts image/webp', () => {
    expect(isAllowedMimeType('image/webp')).toBe(true);
  });

  it('accepts application/pdf', () => {
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  // Rejected
  it('rejects text/html', () => {
    expect(isAllowedMimeType('text/html')).toBe(false);
  });

  it('rejects application/javascript', () => {
    expect(isAllowedMimeType('application/javascript')).toBe(false);
  });

  it('rejects image/gif', () => {
    expect(isAllowedMimeType('image/gif')).toBe(false);
  });

  it('rejects image/svg+xml', () => {
    expect(isAllowedMimeType('image/svg+xml')).toBe(false);
  });

  it('rejects application/zip', () => {
    expect(isAllowedMimeType('application/zip')).toBe(false);
  });

  it('rejects application/x-executable', () => {
    expect(isAllowedMimeType('application/x-executable')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isAllowedMimeType(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedMimeType('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. isWithinSizeLimit — accepts under 10MB, rejects over
// ---------------------------------------------------------------------------
describe('isWithinSizeLimit', () => {
  it('accepts 1 byte', () => {
    expect(isWithinSizeLimit(1)).toBe(true);
  });

  it('accepts 1 MB', () => {
    expect(isWithinSizeLimit(1 * 1024 * 1024)).toBe(true);
  });

  it('accepts 5 MB', () => {
    expect(isWithinSizeLimit(5 * 1024 * 1024)).toBe(true);
  });

  it('accepts exactly 10 MB', () => {
    expect(isWithinSizeLimit(MAX_RECEIPT_FILE_SIZE)).toBe(true);
  });

  it('rejects 10 MB + 1 byte', () => {
    expect(isWithinSizeLimit(MAX_RECEIPT_FILE_SIZE + 1)).toBe(false);
  });

  it('rejects 20 MB', () => {
    expect(isWithinSizeLimit(20 * 1024 * 1024)).toBe(false);
  });

  it('rejects 0 bytes (empty file)', () => {
    expect(isWithinSizeLimit(0)).toBe(false);
  });

  it('rejects negative bytes', () => {
    expect(isWithinSizeLimit(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. sanitizeText with custom maxLength (1000 for notes)
// ---------------------------------------------------------------------------
describe('sanitizeText with custom maxLength', () => {
  it('defaults to FILTER_MAX_LENGTH (200)', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeText(long)).toHaveLength(FILTER_MAX_LENGTH);
  });

  it('accepts custom maxLength of 1000 for notes', () => {
    const long = 'n'.repeat(1500);
    expect(sanitizeText(long, NOTES_MAX_LENGTH)).toHaveLength(NOTES_MAX_LENGTH);
  });

  it('trims before applying maxLength', () => {
    const input = '  ' + 'a'.repeat(300) + '  ';
    const result = sanitizeText(input, NOTES_MAX_LENGTH);
    expect(result.startsWith('a')).toBe(true);
    expect(result).toHaveLength(300);
  });

  it('does not truncate strings shorter than maxLength', () => {
    expect(sanitizeText('hello', 1000)).toBe('hello');
  });

  it('handles maxLength of 0', () => {
    expect(sanitizeText('hello', 0)).toBe('');
  });

  it('handles maxLength of 1', () => {
    expect(sanitizeText('hello', 1)).toBe('h');
  });
});
