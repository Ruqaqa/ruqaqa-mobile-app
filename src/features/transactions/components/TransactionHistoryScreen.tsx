import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { UserPermissions } from '@/types/permissions';
import { Transaction, ApprovalStatus } from '../types';
import { TransactionError } from '../services/transactionService';
import { useTransactionList } from '../hooks/useTransactionList';
import { useApprovalAction } from '../hooks/useApprovalAction';
import { FilterBar } from './FilterBar';
import { TransactionList } from './TransactionList';
import { SearchModal } from './SearchModal';
import { TransactionDetailSheet } from './TransactionDetailSheet';

interface TransactionHistoryScreenProps {
  permissions: UserPermissions;
}

export function TransactionHistoryScreen({
  permissions,
}: TransactionHistoryScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const {
    transactions,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    showOwn,
    filters,
    hasActiveFilters,
    setShowOwn,
    setFilters,
    clearFilters,
    loadMore,
    refresh,
    retry,
    updateTransaction,
  } = useTransactionList({
    canViewAll: permissions.canViewAllTransactions,
  });

  const { isUpdating, execute: executeApproval } = useApprovalAction();

  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const handleTransactionPress = useCallback((txn: Transaction) => {
    setSelectedTransaction(txn);
    setDetailVisible(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailVisible(false);
    setSelectedTransaction(null);
  }, []);

  const handleStatusChange = useCallback(
    async (newStatus: ApprovalStatus) => {
      if (!selectedTransaction) return;
      try {
        const updated = await executeApproval(selectedTransaction.id, newStatus);
        if (updated) {
          updateTransaction(updated.id, updated);
          setSelectedTransaction(updated);
        }
      } catch (err) {
        // Error is a TransactionError; the hook throws it.
        // The ApprovalActions component shows the Alert confirmation,
        // so we just silently fail here (the user already saw the loading state).
      }
    },
    [selectedTransaction, executeApproval, updateTransaction],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FilterBar
        showOwn={showOwn}
        onShowOwnChange={setShowOwn}
        canViewAll={permissions.canViewAllTransactions}
        hasActiveFilters={hasActiveFilters}
        onSearchPress={() => setSearchVisible(true)}
        onClearFilters={clearFilters}
      />

      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        error={error}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onRetry={retry}
        onTransactionPress={handleTransactionPress}
      />

      <SearchModal
        visible={searchVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setSearchVisible(false)}
      />

      <TransactionDetailSheet
        transaction={selectedTransaction}
        visible={detailVisible}
        onClose={handleDetailClose}
        canUpdate={permissions.canUpdateTransactions}
        isUpdating={isUpdating}
        onStatusChange={handleStatusChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
