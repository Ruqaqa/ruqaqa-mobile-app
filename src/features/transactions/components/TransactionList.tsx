import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  View,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { FileSearch } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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
  isLoading,
  isLoadingMore,
  isRefreshing,
  hasMore,
  error,
  onLoadMore,
  onRefresh,
  onRetry,
  onTransactionPress,
}: TransactionListProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const contentContainerStyle = useMemo(
    () => ({ paddingVertical: spacing.xs }),
    [spacing.xs],
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionCard
        transaction={item}
        onPress={onTransactionPress}
      />
    ),
    [onTransactionPress],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isLoadingMore, colors.primary]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  // Error state
  if (error) {
    const messageKey = ERROR_MESSAGES[error.code] ?? 'errorUnknown';
    return <ErrorState message={t(messageKey)} onRetry={onRetry} />;
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={
          <EmptyState
            icon={<FileSearch size={64} color={colors.foregroundSecondary} />}
            title={t('noTransactions')}
            subtitle={t('pullDownToRefresh')}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.emptyContainer}
      />
    );
  }

  return (
    <FlatList
      data={transactions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={contentContainerStyle}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
    />
  );
});

const styles = StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    paddingTop: 4,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
