import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Transaction,
  TransactionFilters,
  EMPTY_FILTERS,
} from '../types';
import {
  fetchTransactions,
  TransactionError,
} from '../services/transactionService';
import { hasActiveFilters as checkActiveFilters } from '../utils/sanitize';

interface UseTransactionListParams {
  canViewAll: boolean;
}

interface UseTransactionListReturn {
  transactions: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: TransactionError | null;
  hasMore: boolean;
  showOwn: boolean;
  filters: TransactionFilters;
  hasActiveFilters: boolean;

  setShowOwn: (own: boolean) => void;
  setFilters: (filters: TransactionFilters) => void;
  clearFilters: () => void;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
  updateTransaction: (id: string, updated: Transaction) => void;
}

export function useTransactionList({
  canViewAll,
}: UseTransactionListParams): UseTransactionListReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<TransactionError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showOwn, setShowOwnState] = useState(true);
  const [filters, setFiltersState] = useState<TransactionFilters>(EMPTY_FILTERS);
  const pageRef = useRef(1);
  const isMountedRef = useRef(true);
  const stateRef = useRef({ hasMore, isLoading, isLoadingMore, showOwn, filters });

  // Keep stateRef in sync so stable callbacks can read latest values
  stateRef.current = { hasMore, isLoading, isLoadingMore, showOwn, filters };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const doFetch = useCallback(
    async (page: number, currentShowOwn: boolean, currentFilters: TransactionFilters, append: boolean) => {
      try {
        const result = await fetchTransactions({
          page,
          showOwn: currentShowOwn,
          filters: currentFilters,
        });
        if (!isMountedRef.current) return;
        if (append) {
          setTransactions((prev) => [...prev, ...result.transactions]);
        } else {
          setTransactions(result.transactions);
        }
        setHasMore(result.pagination.hasNextPage);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(
          err instanceof TransactionError
            ? err
            : new TransactionError('UNKNOWN'),
        );
      }
    },
    [],
  );

  // Initial fetch and refetch on showOwn/filters change
  useEffect(() => {
    pageRef.current = 1;
    setIsLoading(true);
    setTransactions([]);
    doFetch(1, showOwn, filters, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [showOwn, filters, doFetch]);

  const setShowOwn = useCallback(
    (own: boolean) => {
      if (!canViewAll) return; // defensive: force own=true
      setShowOwnState(own);
    },
    [canViewAll],
  );

  const setFilters = useCallback((newFilters: TransactionFilters) => {
    setFiltersState(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY_FILTERS);
  }, []);

  const loadMore = useCallback(() => {
    const { hasMore: hm, isLoading: il, isLoadingMore: ilm, showOwn: so, filters: f } = stateRef.current;
    if (!hm || il || ilm) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setIsLoadingMore(true);
    doFetch(nextPage, so, f, true).finally(() => {
      if (isMountedRef.current) setIsLoadingMore(false);
    });
  }, [doFetch]);

  const refresh = useCallback(() => {
    const { showOwn: so, filters: f } = stateRef.current;
    pageRef.current = 1;
    setIsRefreshing(true);
    doFetch(1, so, f, false).finally(() => {
      if (isMountedRef.current) setIsRefreshing(false);
    });
  }, [doFetch]);

  const retry = useCallback(() => {
    const { showOwn: so, filters: f } = stateRef.current;
    pageRef.current = 1;
    setIsLoading(true);
    setError(null);
    setTransactions([]);
    doFetch(1, so, f, false).finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });
  }, [doFetch]);

  const updateTransaction = useCallback(
    (id: string, updated: Transaction) => {
      setTransactions((prev) =>
        prev.map((txn) => (txn.id === id ? updated : txn)),
      );
    },
    [],
  );

  return {
    transactions,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    showOwn,
    filters,
    hasActiveFilters: checkActiveFilters(filters),
    setShowOwn,
    setFilters,
    clearFilters,
    loadMore,
    refresh,
    retry,
    updateTransaction,
  };
}
