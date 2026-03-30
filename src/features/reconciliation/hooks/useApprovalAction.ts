import { useState, useCallback } from 'react';
import { ApprovalStatus } from '../types';
import { updateApprovalStatus, ApprovalStatusResult } from '../services/reconciliationService';

interface UseApprovalActionReturn {
  isUpdating: boolean;
  execute: (
    reconciliationId: string,
    newStatus: ApprovalStatus,
  ) => Promise<ApprovalStatusResult | null>;
}

export function useApprovalAction(): UseApprovalActionReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const execute = useCallback(
    async (
      reconciliationId: string,
      newStatus: ApprovalStatus,
    ): Promise<ApprovalStatusResult | null> => {
      setIsUpdating(true);
      try {
        const updated = await updateApprovalStatus(reconciliationId, newStatus);
        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { isUpdating, execute };
}
