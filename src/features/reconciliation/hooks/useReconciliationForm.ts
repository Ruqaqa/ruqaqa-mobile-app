import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getEmployees, CachedEmployee } from '@/services/employeeCacheService';
import {
  getFinanceChannels,
  CachedFinanceChannel,
} from '@/services/financeChannelService';
import { playSuccessSound } from '@/services/soundService';
import {
  MAX_ATTACHMENTS,
  validateReceiptFile,
  sanitizeFilename,
} from '@/features/transactions/components/ReceiptPickerSection';
import {
  ReconciliationFormData,
  INITIAL_FORM_DATA,
  FORM_TOTAL_STEPS,
  ReconciliationSubmissionResult,
} from '../types';
import { validateStep, isStepValid, StepErrors } from '../utils/formValidation';
import { submitReconciliation } from '../services/reconciliationSubmissionService';

interface UseReconciliationFormOptions {
  onSuccess?: () => void;
}

export function useReconciliationForm({ onSuccess }: UseReconciliationFormOptions = {}) {
  const { t } = useTranslation();

  // Form state
  const [form, setForm] = useState<ReconciliationFormData>({ ...INITIAL_FORM_DATA });
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasSubmitted, setWasSubmitted] = useState(false);

  // Reference data
  const [employees, setEmployees] = useState<CachedEmployee[]>([]);
  const [channels, setChannels] = useState<CachedFinanceChannel[]>([]);

  // Load reference data on mount
  useEffect(() => {
    (async () => {
      const [emps, chs] = await Promise.all([
        getEmployees(),
        getFinanceChannels(),
      ]);
      setEmployees(emps);
      setChannels(chs);
    })();
  }, []);

  // Field updater
  const updateField = useCallback(<K extends keyof ReconciliationFormData>(
    key: K,
    value: ReconciliationFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Validation
  const currentStepErrors = useMemo(
    (): StepErrors => (wasSubmitted ? validateStep(step, form) : {}),
    [step, form, wasSubmitted],
  );

  const currentStepValid = useMemo(
    () => isStepValid(step, form),
    [step, form],
  );

  // Navigation
  const canGoNext = currentStepValid;
  const canGoPrev = step > 0;
  const isLastStep = step === FORM_TOTAL_STEPS - 1;

  const goNext = useCallback(() => {
    if (!currentStepValid) {
      setWasSubmitted(true);
      return;
    }
    if (step < FORM_TOTAL_STEPS - 1) {
      setWasSubmitted(false);
      setStep((s) => s + 1);
    }
  }, [currentStepValid, step]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setWasSubmitted(false);
      setStep((s) => s - 1);
    }
  }, [step]);

  // Submit
  const submit = useCallback(async (): Promise<ReconciliationSubmissionResult> => {
    setWasSubmitted(true);

    // Validate all steps
    for (let s = 0; s < FORM_TOTAL_STEPS; s++) {
      if (!isStepValid(s, form)) {
        setStep(s);
        return { success: false, error: t('pleaseFillAllRequiredFields') };
      }
    }

    if (isSubmitting) return { success: false, error: t('submitting') };
    setIsSubmitting(true);

    try {
      const result = await submitReconciliation(form);

      if (result.success) {
        playSuccessSound(); // fire-and-forget
        setForm({ ...INITIAL_FORM_DATA });
        setStep(0);
        setWasSubmitted(false);
        onSuccess?.();
      }

      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isSubmitting, t, onSuccess]);

  // Attachments
  const addAttachment = useCallback((
    uri: string,
    type: 'image' | 'document',
    name: string,
    mimeType: string,
    fileSize?: number,
  ): string | null => {
    const validationError = validateReceiptFile(mimeType, fileSize);
    if (validationError) return validationError;

    setForm((prev) => {
      if (prev.attachments.length >= MAX_ATTACHMENTS) return prev;
      const attachment = {
        id: `recon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

  // Reset
  const reset = useCallback(() => {
    setForm({ ...INITIAL_FORM_DATA });
    setStep(0);
    setWasSubmitted(false);
  }, []);

  return {
    form,
    step,
    updateField,
    currentStepErrors,
    currentStepValid,
    canGoNext,
    canGoPrev,
    isLastStep,
    goNext,
    goPrev,
    submit,
    reset,
    isSubmitting,
    wasSubmitted,
    employees,
    channels,
    totalSteps: FORM_TOTAL_STEPS,
    addAttachment,
    removeAttachment,
    canAddMore,
    maxAttachments: MAX_ATTACHMENTS,
  };
}
