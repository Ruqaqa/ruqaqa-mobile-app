/**
 * Tests for the useTransactionForm validation logic.
 *
 * The hook has its own inline getErrors() and isValid computation
 * that enforce: statement required, amount required + valid, bankFees required + valid,
 * date required (non-null), otherParty required, partner required (when canSelectPartner).
 *
 * These tests verify the validation rules by extracting the pure logic
 * (no React hooks) to test them directly.
 */

import { isValidSubmissionAmount } from '../utils/sanitize';

/**
 * Mirrors the getErrors() logic from useTransactionForm.
 * Extracted as pure function for testability.
 */
interface FormState {
  statement: string;
  amount: string;
  bankFees: string;
  date: Date | null;
  otherParty: string;
  partner: string | null;
}

function getFormErrors(form: FormState, canSelectPartner = false): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.statement.trim()) errors.statement = 'statementRequired';
  if (!form.amount.trim()) errors.amount = 'statementRequired';
  else if (!isValidSubmissionAmount(form.amount)) errors.amount = 'pleaseEnterValidNumber';
  if (!form.bankFees.trim()) errors.bankFees = 'statementRequired';
  else if (!isValidSubmissionAmount(form.bankFees)) errors.bankFees = 'pleaseEnterValidNumber';
  if (!form.date) errors.date = 'statementRequired';
  if (!form.otherParty.trim()) errors.otherParty = 'statementRequired';
  if (canSelectPartner && !form.partner) errors.partner = 'statementRequired';
  return errors;
}

/**
 * Mirrors the isValid computation from useTransactionForm.
 */
function isFormValid(form: FormState): boolean {
  return (
    form.statement.trim() !== '' &&
    form.amount.trim() !== '' &&
    isValidSubmissionAmount(form.amount) &&
    form.bankFees.trim() !== '' &&
    isValidSubmissionAmount(form.bankFees)
  );
}

function makeValid(overrides: Partial<FormState> = {}): FormState {
  return {
    statement: 'Office supplies',
    amount: '500',
    bankFees: '10',
    date: new Date('2026-03-27'),
    otherParty: 'Vendor Corp',
    partner: 'Employee Name',
    ...overrides,
  };
}

describe('getErrors (hook inline validation)', () => {
  it('returns no errors for valid form', () => {
    expect(getFormErrors(makeValid())).toEqual({});
  });

  it('returns statement error when empty', () => {
    expect(getFormErrors(makeValid({ statement: '' })).statement).toBeDefined();
  });

  it('returns statement error when whitespace only', () => {
    expect(getFormErrors(makeValid({ statement: '   ' })).statement).toBeDefined();
  });

  it('returns amount error when empty', () => {
    expect(getFormErrors(makeValid({ amount: '' })).amount).toBeDefined();
  });

  it('returns amount error for invalid number', () => {
    expect(getFormErrors(makeValid({ amount: 'abc' })).amount).toBeDefined();
  });

  it('returns bankFees error when empty', () => {
    expect(getFormErrors(makeValid({ bankFees: '' })).bankFees).toBeDefined();
  });

  it('returns bankFees error for invalid number', () => {
    expect(getFormErrors(makeValid({ bankFees: 'xyz' })).bankFees).toBeDefined();
  });

  it('returns date error when null', () => {
    expect(getFormErrors(makeValid({ date: null })).date).toBeDefined();
  });

  it('returns no date error when date is provided', () => {
    expect(getFormErrors(makeValid()).date).toBeUndefined();
  });

  it('returns otherParty error when empty', () => {
    expect(getFormErrors(makeValid({ otherParty: '' })).otherParty).toBeDefined();
  });

  it('returns otherParty error when whitespace only', () => {
    expect(getFormErrors(makeValid({ otherParty: '   ' })).otherParty).toBeDefined();
  });

  it('returns no otherParty error when provided', () => {
    expect(getFormErrors(makeValid()).otherParty).toBeUndefined();
  });

  it('returns partner error when canSelectPartner and partner is null', () => {
    expect(getFormErrors(makeValid({ partner: null }), true).partner).toBeDefined();
  });

  it('returns no partner error when canSelectPartner and partner is set', () => {
    expect(getFormErrors(makeValid(), true).partner).toBeUndefined();
  });

  it('returns no partner error when canSelectPartner is false even if partner is null', () => {
    expect(getFormErrors(makeValid({ partner: null }), false).partner).toBeUndefined();
  });

  it('returns multiple errors simultaneously', () => {
    const errors = getFormErrors({
      statement: '',
      amount: '',
      bankFees: '',
      date: null,
      otherParty: '',
      partner: null,
    }, true);
    expect(errors.statement).toBeDefined();
    expect(errors.amount).toBeDefined();
    expect(errors.bankFees).toBeDefined();
    expect(errors.date).toBeDefined();
    expect(errors.otherParty).toBeDefined();
    expect(errors.partner).toBeDefined();
  });
});

describe('isValid (hook submission guard)', () => {
  it('is true when all required fields pass', () => {
    expect(isFormValid(makeValid())).toBe(true);
  });

  it('is false when statement is empty', () => {
    expect(isFormValid(makeValid({ statement: '' }))).toBe(false);
  });

  it('is false when amount is empty', () => {
    expect(isFormValid(makeValid({ amount: '' }))).toBe(false);
  });

  it('is false when amount is invalid', () => {
    expect(isFormValid(makeValid({ amount: 'abc' }))).toBe(false);
  });

  it('is false when bankFees is empty', () => {
    expect(isFormValid(makeValid({ bankFees: '' }))).toBe(false);
  });

  it('is false when bankFees is invalid', () => {
    expect(isFormValid(makeValid({ bankFees: '1.234' }))).toBe(false);
  });

  it('note: isValid does NOT check date (date only checked in getErrors)', () => {
    // This documents an asymmetry: isValid allows null date, but getErrors flags it.
    // The submit() function calls both, so this is safe — but worth documenting.
    expect(isFormValid(makeValid({ date: null }))).toBe(true);
  });

  it('accepts valid decimal amounts', () => {
    expect(isFormValid(makeValid({ amount: '99.50', bankFees: '0.01' }))).toBe(true);
  });
});

describe('date defaults to null', () => {
  it('initial form has null date which triggers validation error', () => {
    const errors = getFormErrors({
      statement: 'Test',
      amount: '100',
      bankFees: '5',
      date: null, // Simulates the INITIAL_FORM default
      otherParty: 'Vendor',
      partner: 'Employee',
    });
    expect(errors.date).toBeDefined();
  });
});
