import {
  validateStep,
  isStepValid,
  type StepErrors,
} from '../utils/formValidation';
import { INITIAL_FORM_DATA, ReconciliationFormData } from '../types';

function makeForm(overrides: Partial<ReconciliationFormData> = {}): ReconciliationFormData {
  return { ...INITIAL_FORM_DATA, ...overrides };
}

// ---------------------------------------------------------------------------
// Step 0: Basic Info
// ---------------------------------------------------------------------------
describe('Step 0 — Basic Info', () => {
  it('requires statement to be non-empty', () => {
    const errors = validateStep(0, makeForm({ statement: '' }));
    expect(errors.statement).toBeDefined();
  });

  it('accepts a valid statement', () => {
    const errors = validateStep(0, makeForm({ statement: 'Test statement', totalAmount: '100', date: new Date() }));
    expect(errors.statement).toBeUndefined();
  });

  it('trims whitespace-only statement', () => {
    const errors = validateStep(0, makeForm({ statement: '   ' }));
    expect(errors.statement).toBeDefined();
  });

  it('requires totalAmount to be non-empty', () => {
    const errors = validateStep(0, makeForm({ totalAmount: '' }));
    expect(errors.totalAmount).toBeDefined();
  });

  it('rejects invalid amount format', () => {
    const errors = validateStep(0, makeForm({ totalAmount: 'abc' }));
    expect(errors.totalAmount).toBeDefined();
  });

  it('rejects negative amount', () => {
    const errors = validateStep(0, makeForm({ totalAmount: '-100' }));
    expect(errors.totalAmount).toBeDefined();
  });

  it('rejects zero amount', () => {
    const errors = validateStep(0, makeForm({ totalAmount: '0' }));
    expect(errors.totalAmount).toBeDefined();
  });

  it('rejects amount exceeding max (999999999)', () => {
    const errors = validateStep(0, makeForm({ totalAmount: '1000000000' }));
    expect(errors.totalAmount).toBeDefined();
  });

  it('accepts valid amount', () => {
    const errors = validateStep(0, makeForm({
      statement: 'Test', totalAmount: '1234.56', date: new Date(),
    }));
    expect(errors.totalAmount).toBeUndefined();
  });

  it('requires date', () => {
    const errors = validateStep(0, makeForm({ date: null }));
    expect(errors.date).toBeDefined();
  });

  it('rejects future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const errors = validateStep(0, makeForm({ date: tomorrow }));
    expect(errors.date).toBeDefined();
  });

  it('accepts today as date', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(),
    }));
    expect(errors.date).toBeUndefined();
  });

  it('does not require bankFees (optional)', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(), bankFees: '',
    }));
    expect(errors.bankFees).toBeUndefined();
  });

  it('validates bankFees format when provided', () => {
    const errors = validateStep(0, makeForm({ bankFees: 'abc' }));
    expect(errors.bankFees).toBeDefined();
  });

  it('accepts valid bankFees', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(), bankFees: '5.50',
    }));
    expect(errors.bankFees).toBeUndefined();
  });

  it('requires bankFeesCurrency when bankFees > 0', () => {
    const errors = validateStep(0, makeForm({
      bankFees: '5',
      bankFeesCurrency: null as any,
    }));
    expect(errors.bankFeesCurrency).toBeDefined();
  });

  it('does not require bankFeesCurrency when bankFees is empty', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(),
      bankFees: '', bankFeesCurrency: null as any,
    }));
    expect(errors.bankFeesCurrency).toBeUndefined();
  });

  it('does not require bankFeesCurrency when bankFees is "0"', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(),
      bankFees: '0', bankFeesCurrency: null as any,
    }));
    expect(errors.bankFeesCurrency).toBeUndefined();
  });

  it('does not require bankFeesCurrency when bankFees is "0.00"', () => {
    const errors = validateStep(0, makeForm({
      statement: 'X', totalAmount: '10', date: new Date(),
      bankFees: '0.00', bankFeesCurrency: null as any,
    }));
    expect(errors.bankFeesCurrency).toBeUndefined();
  });

  it('returns all basic info errors at once', () => {
    const errors = validateStep(0, makeForm());
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Step 1: Reconciliation Type
// ---------------------------------------------------------------------------
describe('Step 1 — Reconciliation Type', () => {
  it('accepts default type (normal)', () => {
    const errors = validateStep(1, makeForm({ type: 'normal' }));
    expect(errors.type).toBeUndefined();
  });

  it('accepts salary type', () => {
    const errors = validateStep(1, makeForm({ type: 'salary' }));
    expect(errors.type).toBeUndefined();
  });

  it('accepts bonus type', () => {
    const errors = validateStep(1, makeForm({ type: 'bonus' }));
    expect(errors.type).toBeUndefined();
  });

  it('rejects null type', () => {
    const errors = validateStep(1, makeForm({ type: null as any }));
    expect(errors.type).toBeDefined();
  });

  it('rejects invalid type string', () => {
    const errors = validateStep(1, makeForm({ type: 'invalid' as any }));
    expect(errors.type).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Step 2: Sender Details
// ---------------------------------------------------------------------------
describe('Step 2 — Sender Details', () => {
  it('requires fromType', () => {
    const errors = validateStep(2, makeForm({ fromType: null as any }));
    expect(errors.fromType).toBeDefined();
  });

  it('accepts wallet fromType', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'المحفظة',
      senderChannel: '507f1f77bcf86cd799439011',
    }));
    expect(errors.fromType).toBeUndefined();
  });

  it('requires fromEmployee when fromType is employee', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'employee',
      fromEmployee: null,
    }));
    expect(errors.fromEmployee).toBeDefined();
  });

  it('accepts valid fromEmployee ObjectId when fromType is employee', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'employee',
      fromEmployee: '507f1f77bcf86cd799439011',
      senderChannel: '507f1f77bcf86cd799439012',
    }));
    expect(errors.fromEmployee).toBeUndefined();
  });

  it('rejects invalid fromEmployee ObjectId', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'employee',
      fromEmployee: 'not-an-objectid',
    }));
    expect(errors.fromEmployee).toBeDefined();
  });

  it('does not require fromEmployee when fromType is wallet', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'المحفظة',
      fromEmployee: null,
      senderChannel: '507f1f77bcf86cd799439011',
    }));
    expect(errors.fromEmployee).toBeUndefined();
  });

  it('requires senderChannel', () => {
    const errors = validateStep(2, makeForm({ senderChannel: null }));
    expect(errors.senderChannel).toBeDefined();
  });

  it('rejects invalid senderChannel ObjectId', () => {
    const errors = validateStep(2, makeForm({ senderChannel: 'bad-id' }));
    expect(errors.senderChannel).toBeDefined();
  });

  it('accepts valid senderChannel', () => {
    const errors = validateStep(2, makeForm({
      fromType: 'المحفظة',
      senderChannel: '507f1f77bcf86cd799439011',
    }));
    expect(errors.senderChannel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Step 3: Receiver Details
// ---------------------------------------------------------------------------
describe('Step 3 — Receiver Details', () => {
  it('requires toType', () => {
    const errors = validateStep(3, makeForm({ toType: null as any }));
    expect(errors.toType).toBeDefined();
  });

  it('requires toEmployee when toType is employee', () => {
    const errors = validateStep(3, makeForm({
      toType: 'employee',
      toEmployee: null,
    }));
    expect(errors.toEmployee).toBeDefined();
  });

  it('accepts valid toEmployee ObjectId', () => {
    const errors = validateStep(3, makeForm({
      toType: 'employee',
      toEmployee: '507f1f77bcf86cd799439011',
    }));
    expect(errors.toEmployee).toBeUndefined();
  });

  it('requires receiverChannel', () => {
    const errors = validateStep(3, makeForm({
      toType: 'المحفظة',
      receiverChannel: null,
    }));
    expect(errors.receiverChannel).toBeDefined();
  });

  it('rejects empty receiverChannel', () => {
    const errors = validateStep(3, makeForm({
      toType: 'المحفظة',
      receiverChannel: '',
    }));
    expect(errors.receiverChannel).toBeDefined();
  });

  it('rejects invalid receiverChannel ObjectId', () => {
    const errors = validateStep(3, makeForm({
      toType: 'المحفظة',
      receiverChannel: 'bad-id',
    }));
    expect(errors.receiverChannel).toBeDefined();
  });

  it('accepts valid receiverChannel', () => {
    const errors = validateStep(3, makeForm({
      toType: 'المحفظة',
      receiverChannel: '507f1f77bcf86cd799439011',
    }));
    expect(errors.receiverChannel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Step 4: Additional Info (always valid)
// ---------------------------------------------------------------------------
describe('Step 4 — Additional Info', () => {
  it('always returns no errors', () => {
    const errors = validateStep(4, makeForm());
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('is valid even with notes', () => {
    const errors = validateStep(4, makeForm({ notes: 'some notes' }));
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('is valid with attachments', () => {
    const errors = validateStep(4, makeForm({
      attachments: [
        { id: 'att_1', uri: 'file:///photo.jpg', type: 'image', name: 'photo.jpg', mimeType: 'image/jpeg' },
      ],
    }));
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// INITIAL_FORM_DATA defaults
// ---------------------------------------------------------------------------
describe('INITIAL_FORM_DATA', () => {
  it('has empty attachments array by default', () => {
    expect(INITIAL_FORM_DATA.attachments).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isStepValid helper
// ---------------------------------------------------------------------------
describe('isStepValid', () => {
  it('returns false when step has errors', () => {
    expect(isStepValid(0, makeForm())).toBe(false);
  });

  it('returns true when step has no errors', () => {
    expect(isStepValid(0, makeForm({
      statement: 'Test', totalAmount: '100', date: new Date(),
    }))).toBe(true);
  });

  it('step 1 is valid by default (type defaults to normal)', () => {
    expect(isStepValid(1, makeForm())).toBe(true);
  });

  it('step 4 is always valid', () => {
    expect(isStepValid(4, makeForm())).toBe(true);
  });
});
