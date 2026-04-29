import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { useAuth } from '@/services/authContext';
import { useExposeRefresh } from '@/hooks/useExposeRefresh';
import { UserPermissions } from '@/types/permissions';
import { Transaction, ApprovalStatus } from '../types';
import { useTransactionList } from '../hooks/useTransactionList';
import { useApprovalAction } from '../hooks/useApprovalAction';
import { getReceiptEditMode } from '../utils/receiptEditorPermissions';
import {
  createUploadHandler,
  createSaveCompleteHandler,
} from '../utils/receiptEditorHandlers';
import { FilterBar } from './FilterBar';
import { TransactionList } from './TransactionList';
import { SearchModal } from './SearchModal';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { ReceiptEditorScreen, ReceiptEditorMode } from './ReceiptEditorScreen';

interface TransactionHistoryScreenProps {
  permissions: UserPermissions;
  onReady?: (api: { refresh: () => void }) => void;
}

export function TransactionHistoryScreen({
  permissions,
  onReady,
}: TransactionHistoryScreenProps) {
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

  useExposeRefresh(onReady, refresh);

  const [searchVisible, setSearchVisible] = useState(false);

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { isUpdating, execute: executeApproval } = useApprovalAction();

  // --- Receipt editor state ---
  const { employee } = useAuth();
  const [receiptEditorVisible, setReceiptEditorVisible] = useState(false);
  const [receiptEditorMode, setReceiptEditorMode] =
    useState<ReceiptEditorMode>('add');

  // Compute receipt edit mode for the selected transaction
  const receiptEditMode = useMemo(() => {
    if (!selectedTransaction) return null;
    return getReceiptEditMode(
      selectedTransaction,
      permissions,
      employee?.id ?? null,
    );
  }, [selectedTransaction, permissions, employee?.id]);

  const canAddReceipts = receiptEditMode === 'add-only';
  const canEditReceipts = receiptEditMode === 'full-edit';

  const handleEditReceipts = useCallback(
    (mode: 'add' | 'edit') => {
      setReceiptEditorMode(mode);
      setDetailVisible(false);
      setReceiptEditorVisible(true);
    },
    [],
  );

  const handleReceiptEditorClose = useCallback(() => {
    setReceiptEditorVisible(false);
  }, []);

  const uploadHandler = useMemo(() => createUploadHandler(), []);

  const handleReceiptSaveComplete = useCallback(
    async (updatedReceipts: import('../types').TransactionReceipt[]) => {
      if (!selectedTransaction) return;

      const handler = createSaveCompleteHandler({
        transactionId: selectedTransaction.id,
        mode: receiptEditorMode,
        existingReceiptIds: (selectedTransaction.expenseReceipts ?? []).map(
          (r) => r.id,
        ),
        onRefresh: () => {
          refresh();
        },
      });

      await handler(updatedReceipts);
    },
    [selectedTransaction, receiptEditorMode, refresh],
  );

  // Stable callback — only depends on state setters (stable by React guarantee)
  const handleSearchPress = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
  }, []);

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
        onSearchPress={handleSearchPress}
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
        showOwn={showOwn}
        onApply={setFilters}
        onClose={handleSearchClose}
      />

      <TransactionDetailSheet
        transaction={selectedTransaction}
        visible={detailVisible}
        onClose={handleDetailClose}
        canUpdate={permissions.canUpdateTransactions}
        isUpdating={isUpdating}
        onStatusChange={handleStatusChange}
        canAddReceipts={canAddReceipts}
        canEditReceipts={canEditReceipts}
        onEditReceipts={handleEditReceipts}
      />

      {selectedTransaction && (
        <ReceiptEditorScreen
          visible={receiptEditorVisible}
          mode={receiptEditorMode}
          transactionId={selectedTransaction.id}
          existingReceipts={selectedTransaction.expenseReceipts ?? []}
          onClose={handleReceiptEditorClose}
          onSaveComplete={handleReceiptSaveComplete}
          onUploadFiles={uploadHandler}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
