import React, { useCallback, useMemo, ReactElement } from 'react';
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

interface PaginatedListProps<T> {
  data: T[];
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  errorMessageMap: Record<string, string>;
  hasMore: boolean;
  emptyTitle: string;
  emptySubtitle?: string;
  onLoadMore: () => void;
  onRefresh: () => void;
  onRetry: () => void;
}

function PaginatedListInner<T>({
  data,
  renderItem,
  keyExtractor,
  isLoading,
  isLoadingMore,
  isRefreshing,
  error,
  errorMessageMap,
  hasMore,
  emptyTitle,
  emptySubtitle,
  onLoadMore,
  onRefresh,
  onRetry,
}: PaginatedListProps<T>) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const contentContainerStyle = useMemo(
    () => ({ paddingVertical: spacing.xs }),
    [spacing.xs],
  );

  const renderFlatListItem = useCallback(
    ({ item }: { item: T }) => renderItem(item),
    [renderItem],
  );

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
    const messageKey = errorMessageMap[error.code] ?? errorMessageMap['UNKNOWN'] ?? 'errorUnknown';
    return <ErrorState message={t(messageKey)} onRetry={onRetry} />;
  }

  // Empty state
  if (data.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={
          <EmptyState
            icon={<FileSearch size={64} color={colors.foregroundSecondary} />}
            title={emptyTitle}
            subtitle={emptySubtitle}
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
      data={data}
      renderItem={renderFlatListItem}
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
}

export const PaginatedList = React.memo(PaginatedListInner) as typeof PaginatedListInner;

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
