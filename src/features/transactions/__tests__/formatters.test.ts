import {
  formatDate,
  formatAmount,
  getAmountColor,
  getPartnerDisplay,
  getEmployeeDisplay,
} from '../utils/formatters';
import { WALLET_PARTNER, BALAD_CARD_PARTNER } from '../types';

describe('formatDate', () => {
  it('formats ISO date string to DD/MM/YYYY', () => {
    expect(formatDate('2025-03-15T10:30:00Z')).toBe('15/03/2025');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('\u2014');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('\u2014');
  });

  it('returns dash for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('\u2014');
  });

  it('formats date-only string', () => {
    expect(formatDate('2025-01-01')).toBe('01/01/2025');
  });
});

describe('formatAmount', () => {
  it('formats positive amount with two decimals', () => {
    expect(formatAmount(1500)).toBe('1,500.00');
  });

  it('formats negative amount with two decimals', () => {
    expect(formatAmount(-250.5)).toBe('-250.50');
  });

  it('formats zero', () => {
    expect(formatAmount(0)).toBe('0.00');
  });

  it('formats large amounts with commas', () => {
    expect(formatAmount(1234567.89)).toBe('1,234,567.89');
  });
});

describe('getAmountColor', () => {
  it('returns success color key for positive amounts', () => {
    expect(getAmountColor(100)).toBe('success');
  });

  it('returns error color key for negative amounts', () => {
    expect(getAmountColor(-100)).toBe('error');
  });

  it('returns foregroundSecondary for zero', () => {
    expect(getAmountColor(0)).toBe('foregroundSecondary');
  });
});

describe('getPartnerDisplay', () => {
  it('returns employee display name when partnerEmployee is an object', () => {
    expect(
      getPartnerDisplay({
        partnerType: 'employee',
        partnerEmployee: { id: '1', firstName: 'John', lastName: 'Doe' },
      }),
    ).toBe('John Doe');
  });

  it('returns the Arabic wallet label when partnerType is المحفظة', () => {
    expect(
      getPartnerDisplay({
        partnerType: WALLET_PARTNER,
        partnerEmployee: undefined,
      }),
    ).toBe(WALLET_PARTNER);
  });

  it('returns the Arabic balad card label when partnerType is بطاقة البلاد', () => {
    expect(
      getPartnerDisplay({
        partnerType: BALAD_CARD_PARTNER,
        partnerEmployee: undefined,
      }),
    ).toBe(BALAD_CARD_PARTNER);
  });

  it('returns null when no partner info', () => {
    expect(
      getPartnerDisplay({
        partnerType: undefined,
        partnerEmployee: undefined,
      }),
    ).toBeNull();
  });

  it('returns employee id when partnerEmployee is a string', () => {
    expect(
      getPartnerDisplay({
        partnerType: 'employee',
        partnerEmployee: 'emp-123',
      }),
    ).toBe('emp-123');
  });
});

describe('getEmployeeDisplay', () => {
  it('returns firstName + lastName when both present', () => {
    expect(
      getEmployeeDisplay({ id: '1', firstName: 'Jane', lastName: 'Smith' }),
    ).toBe('Jane Smith');
  });

  it('returns firstName only when lastName missing', () => {
    expect(
      getEmployeeDisplay({ id: '1', firstName: 'Jane' }),
    ).toBe('Jane');
  });

  it('returns email when no name fields', () => {
    expect(
      getEmployeeDisplay({ id: '1', email: 'jane@test.com' }),
    ).toBe('jane@test.com');
  });

  it('returns id when nothing else available', () => {
    expect(getEmployeeDisplay({ id: '1' })).toBe('1');
  });

  it('returns null for null input', () => {
    expect(getEmployeeDisplay(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getEmployeeDisplay(undefined)).toBeNull();
  });

  it('returns the string when input is a string (unpopulated ref)', () => {
    expect(getEmployeeDisplay('emp-456')).toBe('emp-456');
  });
});
