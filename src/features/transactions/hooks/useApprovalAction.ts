import { useState, useCallback } from 'react';
import { Transaction, ApprovalStatus } from '../types';
import { updateApprovalStatus } from '../services/transactionService';

interface UseApprovalActionReturn {
  isUpdating: boolean;
  execute: (
    transactionId: string,
    newStatus: ApprovalStatus,
  ) => Promise<Transaction | null>;
}

export function useApprovalAction(): UseApprovalActionReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const execute = useCallback(
    async (
      transactionId: string,
      newStatus: ApprovalStatus,
    ): Promise<Transaction | null> => {
      setIsUpdating(true);
      try {
        const updated = await updateApprovalStatus(transactionId, newStatus);
        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { isUpdating, execute };
}
