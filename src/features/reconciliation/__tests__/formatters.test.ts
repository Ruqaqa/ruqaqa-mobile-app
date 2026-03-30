import {
  formatDate,
  formatAmount,
  getPartyDisplay,
  getChannelDisplay,
  getTypeBadgeConfig,
} from '../utils/formatters';

describe('formatDate', () => {
  it('formats ISO date to DD/MM/YYYY', () => {
    expect(formatDate('2025-03-15T10:30:00Z')).toBe('15/03/2025');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('\u2014');
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

  it('pads single-digit day and month', () => {
    expect(formatDate('2025-02-05')).toBe('05/02/2025');
  });
});

describe('formatAmount', () => {
  it('formats amount with SAR currency symbol', () => {
    const result = formatAmount(1500, 'SAR');
    expect(result).toContain('1,500.00');
    // Should use the Arabic riyal symbol
    expect(result).toContain('ر.س');
  });

  it('formats amount with USD as $', () => {
    expect(formatAmount(250.5, 'USD')).toBe('$ 250.50');
  });

  it('formats amount with ريال سعودي as SAR symbol', () => {
    const result = formatAmount(100, 'ريال سعودي');
    expect(result).toContain('ر.س');
  });

  it('formats amount with دولار أمريكي as $', () => {
    expect(formatAmount(100, 'دولار أمريكي')).toBe('$ 100.00');
  });

  it('formats zero', () => {
    expect(formatAmount(0, 'SAR')).toContain('0.00');
  });

  it('formats negative amount', () => {
    const result = formatAmount(-500, 'SAR');
    expect(result).toContain('500.00');
  });

  it('formats unknown currency with currency code', () => {
    expect(formatAmount(100, 'EUR')).toBe('EUR 100.00');
  });
});

describe('getPartyDisplay', () => {
  it('returns employee name for employee type', () => {
    expect(
      getPartyDisplay('employee', { id: '1', name: 'John Doe' }),
    ).toBe('John Doe');
  });

  it('returns raw type string for المحفظة', () => {
    expect(getPartyDisplay('المحفظة', null)).toBe('المحفظة');
  });

  it('returns raw type string for بطاقة البلاد', () => {
    expect(getPartyDisplay('بطاقة البلاد', null)).toBe('بطاقة البلاد');
  });

  it('returns dash when type is null', () => {
    expect(getPartyDisplay(null, null)).toBe('\u2014');
  });

  it('returns type string for unknown type with no employee', () => {
    expect(getPartyDisplay('custom_type', null)).toBe('custom_type');
  });

  it('returns type string for non-employee type even when employee is present', () => {
    expect(
      getPartyDisplay('المحفظة', { id: '1', name: 'Jane' }),
    ).toBe('المحفظة');
  });

  it('returns dash for employee with null name', () => {
    expect(
      getPartyDisplay('employee', { id: '1', name: null }),
    ).toBe('\u2014');
  });
});

describe('getChannelDisplay', () => {
  it('returns channel name when present', () => {
    expect(getChannelDisplay({ id: '1', name: 'Bank Transfer' })).toBe('Bank Transfer');
  });

  it('returns dash for null channel', () => {
    expect(getChannelDisplay(null)).toBe('\u2014');
  });

  it('returns dash for channel with null name', () => {
    expect(getChannelDisplay({ id: '1', name: null })).toBe('\u2014');
  });
});

describe('getTypeBadgeConfig', () => {
  it('returns blue config for salary', () => {
    const config = getTypeBadgeConfig('salary');
    expect(config.color).toBe('#3b82f6');
    expect(config.label).toBe('typeSalary');
  });

  it('returns purple config for bonus', () => {
    const config = getTypeBadgeConfig('bonus');
    expect(config.color).toBe('#7c3aed');
    expect(config.label).toBe('typeBonus');
  });

  it('returns grey config for normal', () => {
    const config = getTypeBadgeConfig('normal');
    expect(config.color).toBe('#6b7280');
    expect(config.label).toBe('typeNormal');
  });

  it('returns grey config for unknown type', () => {
    const config = getTypeBadgeConfig('unknown');
    expect(config.color).toBe('#6b7280');
    expect(config.label).toBe('typeNormal');
  });
});
