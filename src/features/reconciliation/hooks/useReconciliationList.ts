import { usePagedList } from '@/hooks/usePagedList';
import { fetchReconciliations } from '../services/reconciliationService';
import { Reconciliation, ReconciliationFilters, EMPTY_FILTERS } from '../types';
import { hasActiveFilters } from '../utils/sanitize';

interface UseReconciliationListParams {
  canViewAll: boolean;
}

export function useReconciliationList({ canViewAll }: UseReconciliationListParams) {
  const result = usePagedList<Reconciliation, ReconciliationFilters>({
    fetchFn: async ({ page, showOwn, filters }) => {
      const response = await fetchReconciliations({ page, showOwn, filters });
      return { items: response.reconciliations, pagination: response.pagination };
    },
    emptyFilters: EMPTY_FILTERS,
    hasActiveFiltersFn: hasActiveFilters,
    canViewAll,
  });

  return {
    ...result,
    reconciliations: result.items,
    updateReconciliation: (id: string, updated: Reconciliation) =>
      result.updateItem(id, updated),
  };
}
