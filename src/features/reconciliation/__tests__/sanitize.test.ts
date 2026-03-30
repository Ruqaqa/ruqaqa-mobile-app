import {
  isValidReconciliationType,
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

describe('sanitizeFilters', () => {
  it('returns EMPTY_FILTERS for empty input', () => {
    expect(sanitizeFilters(EMPTY_FILTERS)).toEqual(EMPTY_FILTERS);
  });

  it('trims text fields', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      statement: '  office rent  ',
      reconciliationNumber: '  REC-001  ',
      employee: '  John Doe  ',
    };
    const result = sanitizeFilters(filters);
    expect(result.statement).toBe('office rent');
    expect(result.reconciliationNumber).toBe('REC-001');
    expect(result.employee).toBe('John Doe');
  });

  it('drops invalid amount', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amount: 'not-a-number',
    };
    expect(sanitizeFilters(filters).amount).toBe('');
  });

  it('keeps valid amount', () => {
    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      amount: '500.50',
    };
    expect(sanitizeFilters(filters).amount).toBe('500.50');
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

  it('returns true when employee is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, employee: 'John' })).toBe(true);
  });

  it('returns true when amount is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, amount: '500' })).toBe(true);
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
