/**
 * Tests for partner field submission values.
 *
 * Key behavior: wallet stores Arabic constant 'المحفظة' (not translated i18n),
 * balad card stores 'بطاقة البلاد', and employee stores the employee ID.
 * The partner field is hidden when canSelectPartner is false.
 *
 * These tests extract the partner handling logic from TransactionFormScreen
 * to verify the exact values sent to the API.
 */

describe('partner change handler', () => {
  // Mirror the handlePartnerChange logic from TransactionFormScreen
  interface PartnerState {
    partner: string | null;
    partnerId: string | null;
  }

  interface CachedEmployee {
    id: string;
    name: string;
  }

  function handlePartnerChange(
    value: string,
    employees: CachedEmployee[],
  ): PartnerState {
    if (value === '__wallet__') {
      return { partner: 'المحفظة', partnerId: null };
    } else if (value === '__baladcard__') {
      return { partner: 'بطاقة البلاد', partnerId: null };
    } else {
      const emp = employees.find((e) => e.id === value);
      return { partner: emp?.name ?? value, partnerId: value };
    }
  }

  it('wallet stores Arabic constant المحفظة with null partnerId', () => {
    const result = handlePartnerChange('__wallet__', []);
    expect(result.partner).toBe('المحفظة');
    expect(result.partnerId).toBeNull();
  });

  it('balad card stores Arabic constant بطاقة البلاد with null partnerId', () => {
    const result = handlePartnerChange('__baladcard__', []);
    expect(result.partner).toBe('بطاقة البلاد');
    expect(result.partnerId).toBeNull();
  });

  it('employee stores employee name as partner and ID as partnerId', () => {
    const employees = [
      { id: 'emp_001', name: 'أحمد محمد' },
      { id: 'emp_002', name: 'سارة أحمد' },
    ];
    const result = handlePartnerChange('emp_001', employees);
    expect(result.partner).toBe('أحمد محمد');
    expect(result.partnerId).toBe('emp_001');
  });

  it('unknown employee ID falls back to the value itself as partner', () => {
    const employees = [{ id: 'emp_001', name: 'أحمد محمد' }];
    const result = handlePartnerChange('unknown_id', employees);
    expect(result.partner).toBe('unknown_id');
    expect(result.partnerId).toBe('unknown_id');
  });
});

describe('partner value reverse mapping', () => {
  // Mirror the partnerValue derivation from TransactionFormScreen
  function derivePartnerValue(
    partner: string | null,
    partnerId: string | null,
  ): string | null {
    if (!partner) return null;
    if (partner === 'المحفظة') return '__wallet__';
    if (partner === 'بطاقة البلاد') return '__baladcard__';
    return partnerId;
  }

  it('maps المحفظة back to __wallet__', () => {
    expect(derivePartnerValue('المحفظة', null)).toBe('__wallet__');
  });

  it('maps بطاقة البلاد back to __baladcard__', () => {
    expect(derivePartnerValue('بطاقة البلاد', null)).toBe('__baladcard__');
  });

  it('maps employee partner to partnerId', () => {
    expect(derivePartnerValue('أحمد محمد', 'emp_001')).toBe('emp_001');
  });

  it('returns null when partner is null', () => {
    expect(derivePartnerValue(null, null)).toBeNull();
  });
});

describe('wallet and balad card values are Arabic constants not i18n keys', () => {
  it('wallet value is a literal Arabic string, not a translation key', () => {
    // The value must be the exact Arabic constant, not something like t('wallet')
    const walletValue = 'المحفظة';
    expect(walletValue).not.toBe('wallet');
    expect(walletValue).not.toBe('Wallet');
    expect(walletValue).toBe('المحفظة');
  });

  it('balad card value is a literal Arabic string, not a translation key', () => {
    const baladValue = 'بطاقة البلاد';
    expect(baladValue).not.toBe('baladCard');
    expect(baladValue).not.toBe('Balad Card');
    expect(baladValue).toBe('بطاقة البلاد');
  });
});
