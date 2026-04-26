import { formatDate, formatAmount, formatDateParam } from '../formatters';

describe('formatDate', () => {
  it('formats ISO date string to DD/MM/YYYY', () => {
    expect(formatDate('2025-03-15T10:30:00Z')).toBe('15/03/2025');
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014');
  });

  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('\u2014');
  });

  it('returns em-dash for invalid string', () => {
    expect(formatDate('not-a-date')).toBe('\u2014');
  });

  it('formats date-only string', () => {
    expect(formatDate('2025-01-01')).toBe('01/01/2025');
  });

  it('pads single-digit day and month', () => {
    expect(formatDate('2025-02-05')).toBe('05/02/2025');
  });

  it('formats Date object using local components', () => {
    expect(formatDate(new Date(2025, 2, 15))).toBe('15/03/2025');
  });

  it('returns em-dash for invalid Date object', () => {
    expect(formatDate(new Date('invalid'))).toBe('—');
  });
});

describe('formatAmount', () => {
  it('formats positive number with two decimal places', () => {
    expect(formatAmount(1500)).toBe('1,500.00');
  });

  it('formats negative number with two decimal places', () => {
    expect(formatAmount(-250.5)).toBe('-250.50');
  });

  it('formats zero', () => {
    expect(formatAmount(0)).toBe('0.00');
  });

  it('returns em-dash for null', () => {
    expect(formatAmount(null)).toBe('\u2014');
  });

  it('returns em-dash for undefined', () => {
    expect(formatAmount(undefined)).toBe('\u2014');
  });

  it('returns em-dash for NaN', () => {
    expect(formatAmount(NaN)).toBe('\u2014');
  });
});

describe('formatDateParam', () => {
  it('formats Date object to YYYY-MM-DD string', () => {
    expect(formatDateParam(new Date('2025-03-20T00:00:00Z'))).toBe('2025-03-20');
  });

  it('formats Date with time component', () => {
    expect(formatDateParam(new Date('2025-01-15T14:30:00Z'))).toBe('2025-01-15');
  });
});
