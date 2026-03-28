import { AxiosError } from 'axios';
import { uploadMultipart } from '@/services/apiClient';
import {
  sanitizeText,
  sanitizeNotes,
  sanitizeFilename,
  isValidCurrency,
  isValidObjectId,
  isAllowedMimeType,
  isWithinSizeLimit,
  isValidSubmissionAmount,
} from '../utils/sanitize';

export class SubmissionError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NETWORK' | 'SERVER' | 'VALIDATION' | 'UNKNOWN',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SubmissionError';
  }
}

import type { TransactionSubmissionData } from '../types';
export type { TransactionSubmissionData } from '../types';

interface SubmissionResult {
  success: boolean;
  transactionNumber?: string;
}

/** Validate an optional ObjectId field. Throws SubmissionError on invalid format. */
function validateObjectId(value: string | null, fieldName: string): void {
  if (value && !isValidObjectId(value)) {
    throw new SubmissionError('VALIDATION', `Invalid ${fieldName} ID format`);
  }
}

export function buildTransactionFormData(
  data: TransactionSubmissionData,
): FormData {
  // Validate enum fields
  if (!isValidCurrency(data.currency)) {
    throw new SubmissionError('VALIDATION', 'Invalid currency');
  }

  // Validate amount format
  if (!isValidSubmissionAmount(data.totalAmount)) {
    throw new SubmissionError('VALIDATION', 'Invalid amount format');
  }

  // Validate ObjectId fields
  validateObjectId(data.partnerEmployee, 'partnerEmployee');
  validateObjectId(data.otherPartyId, 'otherPartyId');
  validateObjectId(data.client, 'client');
  validateObjectId(data.project, 'project');

  // Validate receipt files
  for (const file of data.receipts) {
    if (!isAllowedMimeType(file.type)) {
      throw new SubmissionError('VALIDATION', `File type not allowed: ${file.type}`);
    }
    if (!isWithinSizeLimit(file.size)) {
      throw new SubmissionError('VALIDATION', `File too large: ${file.name}`);
    }
  }

  const formData = new FormData();

  const payload: Record<string, unknown> = {
    'البيان': sanitizeText(data.statement),
    'المبلغ الإجمالي': data.totalAmount.trim(),
    'الضريبة': data.tax,
    'العملة': data.currency,
    'التاريخ': data.transactionDate,
    'طرف الشريك': data.partnerEmployee,
    'الطرف الآخر': data.otherParty ? sanitizeText(data.otherParty) : null,
    'نوع الطرف الآخر': data.otherPartyType,
    'معرف الطرف الآخر': data.otherPartyId,
    'رمز المشروع': data.project,
    'اسم العميل': data.client,
    'ملاحظات': data.notes ? sanitizeNotes(data.notes) : null,
  };

  // Parse bankFees from string at submission time
  if (data.bankFees != null && data.bankFees.trim() !== '') {
    const parsed = parseFloat(data.bankFees);
    if (!isNaN(parsed) && parsed !== 0) {
      payload['رسوم بنكية'] = parsed;
      payload['عملة الرسوم'] = data.bankFeesCurrency;
    }
  }

  formData.append('data', JSON.stringify(payload));

  for (const file of data.receipts) {
    // Sanitize filename by creating a new File with a clean name
    const cleanName = sanitizeFilename(file.name);
    const safeFile = cleanName !== file.name
      ? new File([file], cleanName, { type: file.type })
      : file;
    formData.append('receipts', safeFile);
  }

  return formData;
}

function mapSubmissionError(error: unknown): SubmissionError {
  if (error instanceof SubmissionError) return error;

  if (error instanceof AxiosError) {
    if (!error.response) return new SubmissionError('NETWORK');
    const status = error.response.status;
    if (status === 403) return new SubmissionError('FORBIDDEN');
    if (status >= 500) return new SubmissionError('SERVER');
  }

  return new SubmissionError('UNKNOWN');
}

let submitting = false;

export async function submitTransaction(
  data: TransactionSubmissionData,
  onProgress?: (percent: number) => void,
): Promise<SubmissionResult> {
  if (submitting) {
    throw new SubmissionError('VALIDATION', 'Submission already in progress');
  }

  submitting = true;
  try {
    const formData = buildTransactionFormData(data);
    const response = await uploadMultipart('/transactions', formData, onProgress);

    if (!response.data.success) {
      throw new SubmissionError(
        'VALIDATION',
        response.data.message ?? 'Submission failed',
      );
    }

    return {
      success: true,
      transactionNumber: response.data.transaction?.transactionNumber,
    };
  } catch (error) {
    if (error instanceof SubmissionError) throw error;
    throw mapSubmissionError(error);
  } finally {
    submitting = false;
  }
}

/** Reset the submission guard. Exposed for testing only. */
export function _resetSubmissionGuard(): void {
  submitting = false;
}
