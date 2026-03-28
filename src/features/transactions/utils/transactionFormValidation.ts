import { MAX_RECEIPTS } from '../types';
import {
  isValidSubmissionAmount,
  isValidCurrency,
  isAllowedMimeType,
  isWithinSizeLimit,
} from './sanitize';

export const DEFAULT_CURRENCY = 'ريال سعودي';

export interface TransactionFormData {
  statement: string;
  amount: string;
  currency: string;
  taxEnabled: boolean;
  tax: string | null;
  bankFees: string;
  date: Date | null;
  receiptCount: number;
}

export interface TransactionFormErrors {
  statement?: string;
  amount?: string;
  currency?: string;
  tax?: string;
  bankFees?: string;
  date?: string;
  receipts?: string;
}

export interface ReceiptFileInfo {
  name: string;
  size: number;
  mimeType: string | undefined;
}

export function validateTransactionForm(
  form: TransactionFormData,
): TransactionFormErrors {
  const errors: TransactionFormErrors = {};

  if (!form.statement.trim()) {
    errors.statement = 'Statement is required';
  }

  if (!form.amount.trim()) {
    errors.amount = 'Amount is required';
  } else if (!isValidSubmissionAmount(form.amount)) {
    errors.amount = 'Amount must be a valid positive number (up to 2 decimal places)';
  } else if (parseFloat(form.amount) === 0) {
    errors.amount = 'Amount cannot be zero';
  }

  if (!isValidCurrency(form.currency)) {
    errors.currency = 'Invalid currency';
  }

  if (form.receiptCount > MAX_RECEIPTS) {
    errors.receipts = `Cannot exceed ${MAX_RECEIPTS} receipts`;
  }

  if (!form.date) {
    errors.date = 'Date is required';
  }

  if (form.taxEnabled && (!form.tax || !form.tax.trim())) {
    errors.tax = 'Tax value is required when tax is enabled';
  }

  if (!form.bankFees.trim()) {
    errors.bankFees = 'Bank fees is required';
  } else if (!isValidSubmissionAmount(form.bankFees)) {
    errors.bankFees = 'Bank fees must be a valid positive number (up to 2 decimal places)';
  }

  return errors;
}

export function validateReceiptFile(file: ReceiptFileInfo): string | null {
  if (!isWithinSizeLimit(file.size)) {
    return 'File size exceeds limit or is empty';
  }

  if (!isAllowedMimeType(file.mimeType)) {
    return 'File type not allowed';
  }

  return null;
}
