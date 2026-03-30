import {
  isValidReconciliationType,
  isValidEntityType,
  sanitizeFilters,
  hasActiveFilters,
} from '../utils/sanitize';
import { EMPTY_FILTERS, ReconciliationFilters } from '../types';

describe('isValidReconciliationType', () => {
  it('returns true for null (no filter)', () => {
    expect(isValidReconciliationType(null)).toBe(true);
  });

  it('returns true for salary', () => {
    expect(isValidReconciliationType('salary')).toBe(true);
  });

  it('returns true for bonus', () => {
    expect(isValidReconciliationType('bonus')).toBe(true);
  });

  it('returns true for normal', () => {
    expect(isValidReconciliationType('normal')).toBe(true);
  });

  it('returns false for uppercase Salary', () => {
    expect(isValidReconciliationType('Salary')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidReconciliationType('invalid')).toBe(false);
  });
});

describe('isValidEntityType', () => {
  it('returns true for null (no filter)', () => {
    expect(isValidEntityType(null)).toBe(true);
  });

  it('returns true for المحفظة', () => {
    expect(isValidEntityType('المحفظة')).toBe(true);
  });

  it('returns true for employee', () => {
    expect(isValidEntityType('employee')).toBe(true);
  });

  it('returns true for بطاقة البلاد', () => {
    expect(isValidEntityType('بطاقة البلاد')).toBe(true);
  });

  it('returns false for arbitrary string', () => {
    expect(isValidEntityType('invalid')).toBe(false);
  });
});

describe('sanitizeFilters', () => {
  it('returns EMPTY_FILTERS for empty input', () => {
    expect(sanitizeFilters(EMPTY_FILTERS)).toEqual(EMPTY_FILTERS);
  });

  it('trims text fields', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      statement: '  office rent  ',
      reconciliationNumber: '  REC-001  ',
    };
    const result = sanitizeFilters(filters);
    expect(result.statement).toBe('office rent');
    expect(result.reconciliationNumber).toBe('REC-001');
  });

  it('keeps valid employee ObjectIds when fromType is employee', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'employee',
      fromEmployee: '507f1f77bcf86cd799439011',
      toType: 'employee',
      toEmployee: 'aabbccddeeff00112233aabb',
    };
    const result = sanitizeFilters(filters);
    expect(result.fromEmployee).toBe('507f1f77bcf86cd799439011');
    expect(result.toEmployee).toBe('aabbccddeeff00112233aabb');
  });

  it('clears fromEmployee when fromType is not employee', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'المحفظة',
      fromEmployee: '507f1f77bcf86cd799439011',
    };
    expect(sanitizeFilters(filters).fromEmployee).toBe('');
  });

  it('clears toEmployee when toType is null', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      toType: null,
      toEmployee: '507f1f77bcf86cd799439011',
    };
    expect(sanitizeFilters(filters).toEmployee).toBe('');
  });

  it('drops invalid employee value (not ObjectId)', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'employee',
      fromEmployee: 'not-an-id',
    };
    expect(sanitizeFilters(filters).fromEmployee).toBe('');
  });

  it('drops invalid amountMin', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMin: 'not-a-number',
    };
    expect(sanitizeFilters(filters).amountMin).toBe('');
  });

  it('keeps valid amountMin', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMin: '500.50',
    };
    expect(sanitizeFilters(filters).amountMin).toBe('500.50');
  });

  it('drops invalid amountMax', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMax: 'abc',
    };
    expect(sanitizeFilters(filters).amountMax).toBe('');
  });

  it('keeps valid amountMax', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMax: '1000',
    };
    expect(sanitizeFilters(filters).amountMax).toBe('1000');
  });

  it('keeps negative amountMin', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMin: '-250.00',
    };
    expect(sanitizeFilters(filters).amountMin).toBe('-250.00');
  });

  it('keeps negative amountMax', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amountMax: '-100',
    };
    expect(sanitizeFilters(filters).amountMax).toBe('-100');
  });

  it('drops invalid reconciliation type', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      type: 'BadType' as any,
    };
    expect(sanitizeFilters(filters).type).toBeNull();
  });

  it('keeps valid reconciliation type', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      type: 'salary',
    };
    expect(sanitizeFilters(filters).type).toBe('salary');
  });

  it('drops invalid senderChannel (non-ObjectId)', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      senderChannel: 'random text',
    };
    expect(sanitizeFilters(filters).senderChannel).toBe('');
  });

  it('keeps valid senderChannel ObjectId', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      senderChannel: '507f1f77bcf86cd799439011',
    };
    expect(sanitizeFilters(filters).senderChannel).toBe('507f1f77bcf86cd799439011');
  });

  it('drops invalid receiverChannel', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      receiverChannel: 'bad',
    };
    expect(sanitizeFilters(filters).receiverChannel).toBe('');
  });

  it('keeps valid receiverChannel ObjectId', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      receiverChannel: 'aabbccddeeff00112233aabb',
    };
    expect(sanitizeFilters(filters).receiverChannel).toBe('aabbccddeeff00112233aabb');
  });

  it('drops invalid approval status', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      approvalStatus: 'BadStatus' as any,
    };
    expect(sanitizeFilters(filters).approvalStatus).toBeNull();
  });

  it('keeps valid approval status', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      approvalStatus: 'Approved',
    };
    expect(sanitizeFilters(filters).approvalStatus).toBe('Approved');
  });

  it('drops invalid fromType', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'BadType' as any,
    };
    expect(sanitizeFilters(filters).fromType).toBeNull();
  });

  it('keeps valid fromType', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'employee',
    };
    expect(sanitizeFilters(filters).fromType).toBe('employee');
  });

  it('drops invalid toType', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      toType: 'wallet' as any,
    };
    expect(sanitizeFilters(filters).toType).toBeNull();
  });

  it('keeps valid toType المحفظة', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      toType: 'المحفظة',
    };
    expect(sanitizeFilters(filters).toType).toBe('المحفظة');
  });

  it('preserves date fields as-is', () => {
    const d = new Date('2025-06-15');
    const filters: ReconciliationFilters = {
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

  it('returns true when reconciliationNumber is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, reconciliationNumber: 'REC-001' })).toBe(true);
  });

  it('returns true when fromEmployee is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, fromEmployee: 'John' })).toBe(true);
  });

  it('returns true when toEmployee is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, toEmployee: 'Jane' })).toBe(true);
  });

  it('returns true when fromType is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, fromType: 'employee' })).toBe(true);
  });

  it('returns true when toType is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, toType: 'المحفظة' })).toBe(true);
  });

  it('returns true when amountMin is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amountMin: '500' })).toBe(true);
  });

  it('returns true when amountMax is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amountMax: '1000' })).toBe(true);
  });

  it('returns true when type is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, type: 'salary' })).toBe(true);
  });

  it('returns true when senderChannel is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, senderChannel: '507f1f77bcf86cd799439011' })).toBe(true);
  });

  it('returns true when receiverChannel is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, receiverChannel: '507f1f77bcf86cd799439011' })).toBe(true);
  });

  it('returns true when dateFrom is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateFrom: new Date() })).toBe(true);
  });

  it('returns true when dateTo is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateTo: new Date() })).toBe(true);
  });

  it('returns true when approvalStatus is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, approvalStatus: 'Pending' })).toBe(true);
  });
});
