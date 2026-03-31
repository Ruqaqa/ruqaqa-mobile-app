import { apiClient, uploadMultipart } from '@/services/apiClient';
import { mapAxiosError, ApiError } from '@/services/errors';
import { sanitizeText } from '@/utils/sanitize';
import { sanitizeFilename } from '@/features/transactions/components/ReceiptPickerSection';
import { NOTES_MAX_LENGTH } from '@/types/shared';
import { ReconciliationFormData, ReconciliationSubmissionResult } from '../types';

/**
 * Build the Arabic-keyed JSON payload for the reconciliation creation API.
 */
export function buildReconciliationPayload(form: ReconciliationFormData): Record<string, any> {
  const statement = sanitizeText(form.statement);
  const totalAmount = parseFloat(form.totalAmount);
  const date = formatDateForAPI(form.date);
  const notes = form.notes.trim() ? sanitizeText(form.notes, NOTES_MAX_LENGTH) : null;

  // Bank fees: only include if present and > 0
  const bankFeesNum = form.bankFees.trim() ? parseFloat(form.bankFees) : 0;
  const hasBankFees = bankFeesNum > 0;

  // Employees: only include if the corresponding type is 'employee'
  const fromEmployee = form.fromType === 'employee' ? form.fromEmployee : null;
  const toEmployee = form.toType === 'employee' ? form.toEmployee : null;

  return {
    'البيان': statement,
    'المبلغ الإجمالي': totalAmount,
    'العملة': form.currency,
    'رسوم بنكية': hasBankFees ? bankFeesNum : null,
    'عملة الرسوم': hasBankFees ? form.bankFeesCurrency : null,
    'النوع': form.type,
    'التاريخ': date,
    'نوع المرسل': form.fromType,
    'الموظف المرسل': fromEmployee,
    'قناة المرسل': form.senderChannel,
    'نوع المستقبل': form.toType,
    'الموظف المستقبل': toEmployee,
    'قناة المستقبل': form.receiverChannel ?? null,
    'ملاحظات': notes,
  };
}

/**
 * Submit a reconciliation to the backend.
 * Uses multipart when attachments are present, JSON otherwise.
 * Returns a typed result — never throws.
 */
export async function submitReconciliation(
  form: ReconciliationFormData,
): Promise<ReconciliationSubmissionResult> {
  try {
    const payload = buildReconciliationPayload(form);
    let response;

    if (form.attachments.length > 0) {
      const formData = new FormData();
      formData.append('data', JSON.stringify(payload));
      for (const att of form.attachments) {
        const cleanName = sanitizeFilename(att.name ?? 'attachment');
        formData.append('attachments', {
          uri: att.uri,
          type: att.mimeType ?? 'application/octet-stream',
          name: cleanName,
        } as any);
      }
      response = await uploadMultipart('/reconciliation', formData);
    } else {
      response = await apiClient.post('/reconciliation', payload);
    }

    if (response.data?.success) {
      return {
        success: true,
        reconciliation: response.data.reconciliation,
      };
    }

    return { success: false, error: 'SERVER' };
  } catch (err: unknown) {
    const apiError = mapAxiosError(err);
    return { success: false, error: apiError.code };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateForAPI(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
