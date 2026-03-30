import { usePagedList } from '@/hooks/usePagedList';
import { fetchTransactions } from '../services/transactionService';
import { Transaction, TransactionFilters, EMPTY_FILTERS } from '../types';
import { hasActiveFilters } from '../utils/sanitize';

interface UseTransactionListParams {
  canViewAll: boolean;
}

export function useTransactionList({ canViewAll }: UseTransactionListParams) {
  const result = usePagedList<Transaction, TransactionFilters>({
    fetchFn: async ({ page, showOwn, filters }) => {
      const response = await fetchTransactions({ page, showOwn, filters });
      return { items: response.transactions, pagination: response.pagination };
    },
    emptyFilters: EMPTY_FILTERS,
    hasActiveFiltersFn: hasActiveFilters,
    canViewAll,
  });

  return {
    ...result,
    transactions: result.items,
    updateTransaction: (id: string, updated: Transaction) =>
      result.updateItem(id, updated),
  };
}
