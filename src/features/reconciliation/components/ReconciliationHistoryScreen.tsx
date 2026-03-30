import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { UserPermissions } from '@/types/permissions';
import { FilterBar } from '@/components/finance/FilterBar';
import { Reconciliation, ApprovalStatus } from '../types';
import { useReconciliationList } from '../hooks/useReconciliationList';
import { useApprovalAction } from '../hooks/useApprovalAction';
import { ReconciliationList } from './ReconciliationList';
import { SearchModal } from './SearchModal';
import { ReconciliationDetailSheet } from './ReconciliationDetailSheet';

interface ReconciliationHistoryScreenProps {
  permissions: UserPermissions;
}

export function ReconciliationHistoryScreen({
  permissions,
}: ReconciliationHistoryScreenProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const {
    reconciliations,
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
    updateReconciliation,
  } = useReconciliationList({
    canViewAll: permissions.canViewAllReconciliations,
  });

  const [searchVisible, setSearchVisible] = useState(false);

  const [selectedReconciliation, setSelectedReconciliation] =
    useState<Reconciliation | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { isUpdating, execute: executeApproval } = useApprovalAction();

  const handleSearchPress = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
  }, []);

  const handleReconciliationPress = useCallback((rec: Reconciliation) => {
    setSelectedReconciliation(rec);
    setDetailVisible(true);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailVisible(false);
    setSelectedReconciliation(null);
  }, []);

  const handleStatusChange = useCallback(
    async (newStatus: ApprovalStatus) => {
      if (!selectedReconciliation) return;
      try {
        const result = await executeApproval(selectedReconciliation.id, newStatus);
        if (result) {
          // Backend PATCH returns only { id, approvalStatus } — merge into
          // the full record so the list/detail keep all fields intact.
          const merged: Reconciliation = {
            ...selectedReconciliation,
            approvalStatus: result.approvalStatus,
          };
          updateReconciliation(merged.id, merged);
          setSelectedReconciliation(merged);
        }
      } catch (err) {
        // Error is a ReconciliationError; the hook throws it.
      }
    },
    [selectedReconciliation, executeApproval, updateReconciliation],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FilterBar
        showOwn={showOwn}
        onShowOwnChange={setShowOwn}
        canViewAll={permissions.canViewAllReconciliations}
        hasActiveFilters={hasActiveFilters}
        onSearchPress={handleSearchPress}
        onClearFilters={clearFilters}
        ownLabel={t('myReconciliations')}
        allLabel={t('allReconciliations')}
      />

      <ReconciliationList
        reconciliations={reconciliations}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        error={error}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onRetry={retry}
        onReconciliationPress={handleReconciliationPress}
      />

      <SearchModal
        visible={searchVisible}
        filters={filters}
        onApply={setFilters}
        onClose={handleSearchClose}
      />

      <ReconciliationDetailSheet
        reconciliation={selectedReconciliation}
        visible={detailVisible}
        onClose={handleDetailClose}
        canUpdate={permissions.canUpdateReconciliation}
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
