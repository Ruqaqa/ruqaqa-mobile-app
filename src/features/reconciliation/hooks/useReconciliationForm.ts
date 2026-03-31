import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getEmployees, CachedEmployee } from '@/services/employeeCacheService';
import {
  getFinanceChannels,
  CachedFinanceChannel,
} from '@/services/financeChannelService';
import { playSuccessSound } from '@/services/soundService';
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
  };
}
