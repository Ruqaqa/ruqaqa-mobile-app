import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PaginatedList } from '@/components/finance/PaginatedList';
import { Transaction } from '../types';
import { TransactionError } from '../services/transactionService';
import { TransactionCard } from './TransactionCard';

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  error: TransactionError | null;
  onLoadMore: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onTransactionPress: (transaction: Transaction) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: 'errorForbidden',
  NOT_FOUND: 'errorNotFound',
  NETWORK: 'errorNetwork',
  SERVER: 'errorServer',
  UNKNOWN: 'errorUnknown',
};

export const TransactionList = React.memo(function TransactionList({
  transactions,
  onTransactionPress,
  ...rest
}: TransactionListProps) {
  const { t } = useTranslation();

  const renderItem = useCallback(
    (item: Transaction) => (
      <TransactionCard transaction={item} onPress={onTransactionPress} />
    ),
    [onTransactionPress],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <PaginatedList
      data={transactions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      errorMessageMap={ERROR_MESSAGES}
      emptyTitle={t('noTransactions')}
      emptySubtitle={t('pullDownToRefresh')}
      {...rest}
    />
  );
});
