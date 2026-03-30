import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PaginatedList } from '@/components/finance/PaginatedList';
import { Reconciliation } from '../types';
import { ReconciliationError } from '../services/reconciliationService';
import { ReconciliationCard } from './ReconciliationCard';

interface ReconciliationListProps {
  reconciliations: Reconciliation[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  error: ReconciliationError | null;
  onLoadMore: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onReconciliationPress: (reconciliation: Reconciliation) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'errorReconciliationForbidden',
  NOT_FOUND: 'errorReconciliationNotFound',
  NETWORK: 'errorReconciliationNetwork',
  SERVER: 'errorReconciliationServer',
  UNKNOWN: 'errorReconciliationUnknown',
};

export const ReconciliationList = React.memo(function ReconciliationList({
  reconciliations,
  onReconciliationPress,
  ...rest
}: ReconciliationListProps) {
  const { t } = useTranslation();

  const renderItem = useCallback(
    (item: Reconciliation) => (
      <ReconciliationCard reconciliation={item} onPress={onReconciliationPress} />
    ),
    [onReconciliationPress],
  );

  const keyExtractor = useCallback((item: Reconciliation) => item.id, []);

  return (
    <PaginatedList
      data={reconciliations}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      errorMessageMap={ERROR_MESSAGES}
      emptyTitle={t('noReconciliationRecords')}
      emptySubtitle={t('pullDownToRefresh')}
      {...rest}
    />
  );
});
