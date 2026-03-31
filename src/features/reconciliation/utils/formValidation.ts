import { ReconciliationFormData, RECONCILIATION_TYPES, ENTITY_TYPES } from '../types';
import { isValidSubmissionAmount, isValidCurrency, isValidObjectId } from '@/utils/sanitize';

export type StepErrors = Partial<Record<keyof ReconciliationFormData, string>>;

const MAX_AMOUNT = 999_999_999;

/**
 * Validate a single step of the reconciliation form.
 * Returns an object of field-name → error-key pairs. Empty = valid.
 */
export function validateStep(step: number, form: ReconciliationFormData): StepErrors {
  switch (step) {
    case 0: return validateBasicInfo(form);
    case 1: return validateType(form);
    case 2: return validateSender(form);
    case 3: return validateReceiver(form);
    case 4: return {}; // Additional info — always valid
    default: return {};
  }
}

/** Boolean shorthand for step validity. */
export function isStepValid(step: number, form: ReconciliationFormData): boolean {
  return Object.keys(validateStep(step, form)).length === 0;
}

// ---------------------------------------------------------------------------
// Per-step validators
// ---------------------------------------------------------------------------

function validateBasicInfo(form: ReconciliationFormData): StepErrors {
  const errors: StepErrors = {};

  // Statement
  if (!form.statement.trim()) {
    errors.statement = 'statementRequired';
  }

  // Total amount
  if (!form.totalAmount.trim()) {
    errors.totalAmount = 'statementRequired';
  } else if (!isValidSubmissionAmount(form.totalAmount)) {
    errors.totalAmount = 'pleaseEnterValidNumber';
  } else {
    const num = parseFloat(form.totalAmount);
    if (num <= 0) {
      errors.totalAmount = 'pleaseEnterValidNumber';
    } else if (num > MAX_AMOUNT) {
      errors.totalAmount = 'pleaseEnterValidNumber';
    }
  }

  // Currency
  if (!isValidCurrency(form.currency)) {
    errors.currency = 'statementRequired';
  }

  // Date
  if (!form.date) {
    errors.date = 'statementRequired';
  } else {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (form.date > today) {
      errors.date = 'statementRequired';
    }
  }

  // Bank fees (optional — only validate format when provided)
  if (form.bankFees.trim()) {
    if (!isValidSubmissionAmount(form.bankFees)) {
      errors.bankFees = 'pleaseEnterValidNumber';
    }
  }

  // Bank fees currency (required when bankFees > 0)
  const hasFees = form.bankFees.trim() && isValidSubmissionAmount(form.bankFees) && parseFloat(form.bankFees) > 0;
  if (hasFees && !isValidCurrency(form.bankFeesCurrency)) {
    errors.bankFeesCurrency = 'mustSelectFeesCurrency';
  }

  return errors;
}

function validateType(form: ReconciliationFormData): StepErrors {
  const errors: StepErrors = {};
  if (!form.type || !(RECONCILIATION_TYPES as readonly string[]).includes(form.type)) {
    errors.type = 'statementRequired';
  }
  return errors;
}

function validateSender(form: ReconciliationFormData): StepErrors {
  const errors: StepErrors = {};

  if (!form.fromType || !(ENTITY_TYPES as readonly string[]).includes(form.fromType)) {
    errors.fromType = 'statementRequired';
  }

  if (form.fromType === 'employee') {
    if (!form.fromEmployee || !isValidObjectId(form.fromEmployee) || form.fromEmployee === '') {
      errors.fromEmployee = 'statementRequired';
    }
  }

  if (!form.senderChannel || !isValidObjectId(form.senderChannel) || form.senderChannel === '') {
    errors.senderChannel = 'statementRequired';
  }

  return errors;
}

function validateReceiver(form: ReconciliationFormData): StepErrors {
  const errors: StepErrors = {};

  if (!form.toType || !(ENTITY_TYPES as readonly string[]).includes(form.toType)) {
    errors.toType = 'statementRequired';
  }

  if (form.toType === 'employee') {
    if (!form.toEmployee || !isValidObjectId(form.toEmployee) || form.toEmployee === '') {
      errors.toEmployee = 'statementRequired';
    }
  }

  if (!form.receiverChannel || !isValidObjectId(form.receiverChannel) || form.receiverChannel === '') {
    errors.receiverChannel = 'statementRequired';
  }

  return errors;
}
