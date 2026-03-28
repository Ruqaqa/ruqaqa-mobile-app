/**
 * Tests for date field validation in the transaction form.
 *
 * The date field defaults to null and must be explicitly set.
 * The form validation (getErrors) and standalone validateTransactionForm
 * must both reject null dates.
 */

import {
  validateTransactionForm,
  TransactionFormData,
} from '../utils/transactionFormValidation';

function makeValidForm(overrides: Partial<TransactionFormData> = {}): TransactionFormData {
  return {
    statement: 'Office supplies',
    amount: '500',
    currency: 'ريال سعودي',
    taxEnabled: false,
    tax: null,
    bankFees: '10',
    date: new Date('2026-03-27'),
    receiptCount: 0,
    ...overrides,
  };
}

describe('date field validation', () => {
  it('returns error when date is null', () => {
    const errors = validateTransactionForm(makeValidForm({ date: null }));
    expect(errors.date).toBeDefined();
  });

  it('returns no date error when date is a valid Date object', () => {
    const errors = validateTransactionForm(makeValidForm({ date: new Date('2026-03-15') }));
    expect(errors.date).toBeUndefined();
  });

  it('includes date error alongside other validation errors', () => {
    const errors = validateTransactionForm(
      makeValidForm({ date: null, statement: '', amount: '' }),
    );
    expect(errors.date).toBeDefined();
    expect(errors.statement).toBeDefined();
    expect(errors.amount).toBeDefined();
  });
});
