import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient, uploadMultipart } from '@/services/apiClient';
import { getLastClientAndProject, saveLastClientAndProject } from '@/services/formCacheService';
import { getEmployees, CachedEmployee } from '@/services/employeeCacheService';
import { UserPermissions, Employee } from '@/types/permissions';
import { AutocompleteItem } from '@/components/ui/AutocompleteField';
import {
  ReceiptAttachment,
  MAX_ATTACHMENTS,
  validateReceiptFile,
  sanitizeFilename,
} from '../components/ReceiptPickerSection';
import {
  isValidSubmissionAmount,
  isValidCurrency,
  isValidObjectId,
  sanitizeText,
  sanitizeNotes,
  sanitizeSubmissionData,
} from '../utils/sanitize';
import { CURRENCIES } from '../types';
import type { TransactionSubmissionData } from '../types';
import { formatDate } from '@/utils/formatters';

export interface TransactionFormData {
  statement: string;
  amount: string;
  isExpense: boolean | null;
  tax: string; // 'نعم' | 'لا'
  currency: string; // 'ريال سعودي' | 'دولار أمريكي'
  bankFees: string;
  bankFeesCurrency: string;
  date: Date | null;
  partner: string | null;
  partnerId: string | null;
  otherParty: string;
  otherPartyType: string | null;
  otherPartyId: string | null;
  client: AutocompleteItem | null;
  project: AutocompleteItem | null;
  notes: string;
  attachments: ReceiptAttachment[];
}

const INITIAL_FORM: TransactionFormData = {
  statement: '',
  amount: '',
  isExpense: null,
  tax: 'لا',
  currency: 'ريال سعودي',
  bankFees: '',
  bankFeesCurrency: 'ريال سعودي',
  date: null,
  partner: null,
  partnerId: null,
  otherParty: '',
  otherPartyType: null,
  otherPartyId: null,
  client: null,
  project: null,
  notes: '',
  attachments: [],
};

const VALID_TAX_VALUES = ['نعم', 'لا'] as const;

interface UseTransactionFormOptions {
  permissions: UserPermissions;
  employee: Employee | null;
  onSuccess?: () => void;
}

export function useTransactionForm({ permissions, employee, onSuccess }: UseTransactionFormOptions) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TransactionFormData>({ ...INITIAL_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const [employees, setEmployees] = useState<CachedEmployee[]>([]);
  const attachmentCounter = useRef(0);

  // Initialize form with employee + cached values
  useEffect(() => {
    (async () => {
      if (employee) {
        setForm((prev) => ({
          ...prev,
          partner: employee.name,
          partnerId: employee.id,
        }));
      }

      const cached = await getLastClientAndProject();
      if (cached.client || cached.project) {
        // '__cached__' marks a chip-rendered cached value; never sent to API
        setForm((prev) => ({
          ...prev,
          ...(cached.client ? { client: { id: '__cached__', label: cached.client! } } : {}),
          ...(cached.project ? { project: { id: '__cached__', label: cached.project! } } : {}),
        }));
      }

      const emps = await getEmployees();
      setEmployees(emps);
    })();
  }, [employee]);

  const updateField = useCallback(<K extends keyof TransactionFormData>(
    key: K,
    value: TransactionFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canSelectPartner = permissions.canSelectPartner;

  // Single source of truth for validation
  const computeErrors = useCallback((): Partial<Record<keyof TransactionFormData, string>> => {
    const errors: Partial<Record<keyof TransactionFormData, string>> = {};
    if (!form.statement.trim()) errors.statement = t('statementRequired');
    if (!form.amount.trim()) errors.amount = t('statementRequired');
    else if (!isValidSubmissionAmount(form.amount)) errors.amount = t('pleaseEnterValidNumber');
    if (form.isExpense === null) errors.isExpense = t('statementRequired');
    // Bank fees only apply to expenses (minus). Revenue transactions (plus) don't have bank fees.
    if (form.isExpense !== false) {
      if (!form.bankFees.trim()) errors.bankFees = t('statementRequired');
      else if (!isValidSubmissionAmount(form.bankFees)) errors.bankFees = t('pleaseEnterValidNumber');
    }
    if (!form.date) errors.date = t('statementRequired');
    if (!form.otherParty.trim()) errors.otherParty = t('statementRequired');
    if (canSelectPartner && !form.partner) errors.partner = t('statementRequired');
    return errors;
  }, [form, t, canSelectPartner]);

  const getErrors = useCallback((): Partial<Record<keyof TransactionFormData, string>> => {
    if (!wasSubmitted) return {};
    return computeErrors();
  }, [wasSubmitted, computeErrors]);

  const isValid = Object.keys(computeErrors()).length === 0;

  // Attachments
  const addAttachment = useCallback((
    uri: string,
    type: 'image' | 'document',
    name: string,
    mimeType: string,
    fileSize?: number,
  ) => {
    const validationError = validateReceiptFile(mimeType, fileSize);
    if (validationError) return validationError;

    setForm((prev) => {
      if (prev.attachments.length >= MAX_ATTACHMENTS) return prev;
      const attachment: ReceiptAttachment = {
        id: `att_${++attachmentCounter.current}`,
        uri,
        type,
        name: sanitizeFilename(name),
        mimeType,
        fileSize,
      };
      return { ...prev, attachments: [...prev.attachments, attachment] };
    });
    return null;
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  }, []);

  const canAddMore = form.attachments.length < MAX_ATTACHMENTS;

  // Amount with sign
  const getActualAmount = (): string => {
    const amt = form.amount.trim();
    if (!amt || !isValidSubmissionAmount(amt)) return '';
    if (form.isExpense === null) return '';
    return form.isExpense ? `-${amt}` : amt;
  };

  const formatDateForAPI = (date: Date | null): string => {
    if (!date) return '';
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
  };

  // Build preview payload (human-readable, for the dialog)
  const buildPreviewPayload = (): Record<string, any> => {
    return {
      'البيان': form.statement,
      'المبلغ الإجمالي': getActualAmount(),
      'الضريبة': form.tax,
      'العملة': form.currency,
      'رسوم بنكية': form.isExpense !== false && form.bankFees ? parseFloat(form.bankFees) : null,
      'عملة الرسوم': form.isExpense !== false ? form.bankFeesCurrency : null,
      'رمز المشروع': form.project?.label ?? null,
      'اسم العميل': form.client?.label ?? null,
      'التاريخ': formatDate(form.date),
      'طرف الشريك': form.partner,
      'الطرف الآخر': form.otherParty || null,
      'ملاحظات': form.notes || null,
    };
  };

  /**
   * Build sanitized submission data using shared sanitizeSubmissionData().
   * Validates enums and IDs before sending.
   */
  const buildSanitizedPayload = (): Record<string, any> => {
    // Use sanitizeSubmissionData for text fields
    const submissionData: TransactionSubmissionData = {
      statement: form.statement,
      totalAmount: getActualAmount(),
      currency: isValidCurrency(form.currency) ? form.currency : CURRENCIES[0],
      tax: (VALID_TAX_VALUES as readonly string[]).includes(form.tax) ? form.tax : 'لا',
      transactionDate: formatDateForAPI(form.date),
      partnerEmployee: (form.partnerId && isValidObjectId(form.partnerId))
        ? form.partnerId
        : (form.partner ? sanitizeText(form.partner) : null),
      otherParty: form.otherParty || null,
      otherPartyType: form.otherPartyType,
      otherPartyId: isValidObjectId(form.otherPartyId) ? form.otherPartyId : null,
      client: form.client?.label?.trim() ? form.client.label.trim() : null,
      project: form.project?.label?.trim() ? form.project.label.trim() : null,
      notes: form.notes || null,
      bankFees: form.bankFees || null,
      bankFeesCurrency: isValidCurrency(form.bankFeesCurrency) ? form.bankFeesCurrency : CURRENCIES[0],
      receipts: [], // handled separately for React Native FormData
    };

    const sanitized = sanitizeSubmissionData(submissionData);

    // Build the Arabic-keyed API payload from sanitized data.
    // Revenue transactions (plus) never carry bank fees.
    const bankFees = form.isExpense !== false
      && sanitized.bankFees
      && isValidSubmissionAmount(sanitized.bankFees)
      ? parseFloat(sanitized.bankFees)
      : null;

    const payload: Record<string, any> = {
      'البيان': sanitized.statement,
      'المبلغ الإجمالي': sanitized.totalAmount,
      'الضريبة': sanitized.tax,
      'العملة': sanitized.currency,
      'رمز المشروع': sanitized.project,
      'اسم العميل': sanitized.client,
      'التاريخ': sanitized.transactionDate,
      'طرف الشريك': sanitized.partnerEmployee,
      'الطرف الآخر': sanitized.otherParty,
      'نوع الطرف الآخر': sanitized.otherPartyType,
      'معرف الطرف الآخر': sanitized.otherPartyId,
      'ملاحظات': sanitized.notes,
    };

    if (bankFees && bankFees !== 0) {
      payload['رسوم بنكية'] = bankFees;
      payload['عملة الرسوم'] = sanitized.bankFeesCurrency;
    }

    return payload;
  };

  // Submit with double-submission guard via isSubmitting state
  const submit = useCallback(async (): Promise<{ success: boolean; transactionNumber?: string; error?: string }> => {
    setWasSubmitted(true);
    if (!isValid) return { success: false, error: t('pleaseFillAllRequiredFields') };
    if (isSubmitting) return { success: false, error: t('submitting') };

    setIsSubmitting(true);
    try {
      const payload = buildSanitizedPayload();

      let response;
      if (form.attachments.length > 0) {
        // React Native FormData: pass { uri, name, type } objects (not browser File)
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        for (const att of form.attachments) {
          formData.append('receipts', {
            uri: att.uri,
            name: sanitizeFilename(att.name ?? `receipt_${att.id}`),
            type: att.mimeType ?? 'application/octet-stream',
          } as any);
        }
        response = await uploadMultipart('/transactions', formData);
      } else {
        response = await apiClient.post('/transactions', payload);
      }

      if (response.data?.success) {
        await saveLastClientAndProject(
          form.client?.label,
          form.project?.label,
        );

        const txnNumber = response.data?.transaction?.transactionNumber;

        const savedClient = form.client;
        const savedProject = form.project;
        setForm({
          ...INITIAL_FORM,
          client: savedClient,
          project: savedProject,
          partner: employee?.name ?? null,
          partnerId: employee?.id ?? null,
        });
        setWasSubmitted(false);

        onSuccess?.();
        return { success: true, transactionNumber: txnNumber };
      }

      // Never display raw server errors
      return { success: false, error: t('serverError') };
    } catch (err: any) {
      if (!err.response) return { success: false, error: t('connectionError') };
      if (err.code === 'ECONNABORTED') return { success: false, error: t('timeoutError') };
      const status = err.response?.status;
      if (status === 403) return { success: false, error: t('errorForbidden') };
      return { success: false, error: t('serverError') };
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isValid, isSubmitting, employee, t, onSuccess]);

  return {
    form,
    updateField,
    getErrors,
    isValid,
    isSubmitting,
    wasSubmitted,
    canSelectPartner,
    employees,
    addAttachment,
    removeAttachment,
    canAddMore,
    maxAttachments: MAX_ATTACHMENTS,
    getActualAmount,
    buildPreviewPayload,
    buildSanitizedPayload,
    submit,
  };
}
