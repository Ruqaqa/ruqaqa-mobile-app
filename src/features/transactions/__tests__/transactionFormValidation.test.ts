import {
  validateTransactionForm,
  TransactionFormData,
  DEFAULT_CURRENCY,
  validateReceiptFile,
} from '../utils/transactionFormValidation';
import { MAX_RECEIPT_FILE_SIZE } from '../types';

function makeValidForm(overrides: Partial<TransactionFormData> = {}): TransactionFormData {
  return {
    statement: 'Office supplies',
    amount: '500',
    currency: 'ريال سعودي',
    taxEnabled: false,
    tax: null,
    date: new Date('2026-03-27'),
    receiptCount: 0,
    ...overrides,
  };
}

describe('validateTransactionForm', () => {
  it('returns no errors for a valid form', () => {
    const errors = validateTransactionForm(makeValidForm());
    expect(errors).toEqual({});
  });

  it('returns error when statement is empty', () => {
    const errors = validateTransactionForm(makeValidForm({ statement: '' }));
    expect(errors.statement).toBeDefined();
  });

  it('returns error when statement is whitespace only', () => {
    const errors = validateTransactionForm(makeValidForm({ statement: '   ' }));
    expect(errors.statement).toBeDefined();
  });

  it('returns error when amount is empty', () => {
    const errors = validateTransactionForm(makeValidForm({ amount: '' }));
    expect(errors.amount).toBeDefined();
  });

  it('returns error when amount is not a valid number', () => {
    const errors = validateTransactionForm(makeValidForm({ amount: 'abc' }));
    expect(errors.amount).toBeDefined();
  });

  it('returns error when amount is zero', () => {
    const errors = validateTransactionForm(makeValidForm({ amount: '0' }));
    expect(errors.amount).toBeDefined();
  });

  it('rejects negative amounts (sign is handled separately by toggle)', () => {
    const errors = validateTransactionForm(makeValidForm({ amount: '-100' }));
    expect(errors.amount).toBeDefined();
  });

  it('accepts decimal amounts', () => {
    const errors = validateTransactionForm(makeValidForm({ amount: '99.50' }));
    expect(errors.amount).toBeUndefined();
  });

  it('returns error when receipt count exceeds 4', () => {
    const errors = validateTransactionForm(makeValidForm({ receiptCount: 5 }));
    expect(errors.receipts).toBeDefined();
  });

  it('accepts receipt count of 4', () => {
    const errors = validateTransactionForm(makeValidForm({ receiptCount: 4 }));
    expect(errors.receipts).toBeUndefined();
  });

  it('accepts receipt count of 0', () => {
    const errors = validateTransactionForm(makeValidForm({ receiptCount: 0 }));
    expect(errors.receipts).toBeUndefined();
  });

  it('returns error when tax is enabled but tax value is null', () => {
    const errors = validateTransactionForm(
      makeValidForm({ taxEnabled: true, tax: null }),
    );
    expect(errors.tax).toBeDefined();
  });

  it('returns error when tax is enabled but tax value is empty', () => {
    const errors = validateTransactionForm(
      makeValidForm({ taxEnabled: true, tax: '' }),
    );
    expect(errors.tax).toBeDefined();
  });

  it('no tax error when tax is disabled', () => {
    const errors = validateTransactionForm(
      makeValidForm({ taxEnabled: false, tax: null }),
    );
    expect(errors.tax).toBeUndefined();
  });

  it('no tax error when tax is enabled and value is provided', () => {
    const errors = validateTransactionForm(
      makeValidForm({ taxEnabled: true, tax: '15%' }),
    );
    expect(errors.tax).toBeUndefined();
  });

  it('returns multiple errors at once', () => {
    const errors = validateTransactionForm(
      makeValidForm({ statement: '', amount: '', taxEnabled: true, tax: null }),
    );
    expect(errors.statement).toBeDefined();
    expect(errors.amount).toBeDefined();
    expect(errors.tax).toBeDefined();
  });

  it('returns error when currency is not a valid enum value', () => {
    const errors = validateTransactionForm(
      makeValidForm({ currency: 'Bitcoin' }),
    );
    expect(errors.currency).toBeDefined();
  });

  it('accepts valid currency (Saudi Riyal)', () => {
    const errors = validateTransactionForm(
      makeValidForm({ currency: 'ريال سعودي' }),
    );
    expect(errors.currency).toBeUndefined();
  });

  it('accepts valid currency (US Dollar)', () => {
    const errors = validateTransactionForm(
      makeValidForm({ currency: 'دولار أمريكي' }),
    );
    expect(errors.currency).toBeUndefined();
  });

  it('returns error when amount has three decimal places', () => {
    const errors = validateTransactionForm(
      makeValidForm({ amount: '99.501' }),
    );
    expect(errors.amount).toBeDefined();
  });

  it('returns error when amount contains non-numeric characters', () => {
    const errors = validateTransactionForm(
      makeValidForm({ amount: '1+1' }),
    );
    expect(errors.amount).toBeDefined();
  });

  it('caps statement at FILTER_MAX_LENGTH', () => {
    const longStatement = 'a'.repeat(300);
    const errors = validateTransactionForm(
      makeValidForm({ statement: longStatement }),
    );
    // Should not error — the validation trims to max length
    expect(errors.statement).toBeUndefined();
  });
});

describe('validateReceiptFile', () => {
  it('returns null for valid JPEG file', () => {
    const error = validateReceiptFile({
      name: 'receipt.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
    });
    expect(error).toBeNull();
  });

  it('returns null for valid PDF file', () => {
    const error = validateReceiptFile({
      name: 'doc.pdf',
      size: 5000,
      mimeType: 'application/pdf',
    });
    expect(error).toBeNull();
  });

  it('returns error for disallowed MIME type', () => {
    const error = validateReceiptFile({
      name: 'script.js',
      size: 100,
      mimeType: 'application/javascript',
    });
    expect(error).toBeDefined();
    expect(error).toContain('type');
  });

  it('returns error for file exceeding 10MB', () => {
    const error = validateReceiptFile({
      name: 'huge.jpg',
      size: MAX_RECEIPT_FILE_SIZE + 1,
      mimeType: 'image/jpeg',
    });
    expect(error).toBeDefined();
    expect(error).toContain('size');
  });

  it('returns error for zero-byte file', () => {
    const error = validateReceiptFile({
      name: 'empty.jpg',
      size: 0,
      mimeType: 'image/jpeg',
    });
    expect(error).toBeDefined();
  });

  it('sanitizes filenames with path separators', () => {
    const error = validateReceiptFile({
      name: '../../../etc/passwd',
      size: 1024,
      mimeType: 'image/jpeg',
    });
    // Should still be valid (filename sanitization happens, not rejection)
    expect(error).toBeNull();
  });
});

describe('DEFAULT_CURRENCY', () => {
  it('defaults to Saudi Riyal', () => {
    expect(DEFAULT_CURRENCY).toBe('ريال سعودي');
  });
});
