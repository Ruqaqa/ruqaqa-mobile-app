import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { withAlpha } from '@/utils/colorUtils';
import { MediaItem } from '../types';
import { MediaGridItem } from './MediaGridItem';

const NUM_COLUMNS = 3;
const GRID_GAP = 4;

interface MediaGridProps {
  items: MediaItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: { code: string } | null;
  hasMore: boolean;
  onItemPress: (index: number) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  /** Whether multi-select mode is active (Phase 5C) */
  isSelectionMode?: boolean;
  /** Set of selected item IDs (Phase 5C) */
  selectedIds?: ReadonlySet<string>;
  /** Called when user long-presses an item to enter selection mode (Phase 5C) */
  onItemLongPress?: (itemId: string) => void;
  /** Called when user taps an item to toggle its selection (Phase 5C) */
  onItemSelect?: (itemId: string) => void;
}

/**
 * A 3-column grid of media thumbnails for an album.
 * Handles loading skeleton, empty state, error state, infinite scroll, and pull-to-refresh.
 */
export function MediaGrid({
  items,
  isLoading,
  isLoadingMore,
  isRefreshing,
  error,
  hasMore,
  onItemPress,
  onRefresh,
  onLoadMore,
  onRetry,
  isSelectionMode = false,
  selectedIds,
  onItemLongPress,
  onItemSelect,
}: MediaGridProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const showSkeleton = isLoading && items.length === 0;
  const showError = !!error && items.length === 0 && !isLoading;
  const showEmpty = items.length === 0 && !isLoading && !error;

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => (
      <View style={styles.gridCell}>
        <MediaGridItem
          item={item}
          onPress={() => onItemPress(index)}
          isSelectionMode={isSelectionMode}
          isSelected={selectedIds?.has(item.id) ?? false}
          onLongPress={onItemLongPress ? () => onItemLongPress(item.id) : undefined}
          onSelect={onItemSelect ? () => onItemSelect(item.id) : undefined}
        />
      </View>
    ),
    [onItemPress, isSelectionMode, selectedIds, onItemLongPress, onItemSelect],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isLoadingMore, colors.primary]);

  if (showSkeleton) {
    return <MediaGridSkeleton color={colors.foregroundSecondary} />;
  }

  if (showError) {
    return <ErrorState message={t('failedToLoadMedia')} onRetry={onRetry} />;
  }

  if (showEmpty) {
    return (
      <EmptyState
        icon={<ImageIcon size={48} color={colors.foregroundSecondary} />}
        title={t('noItemsInAlbum')}
      />
    );
  }

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      extraData={selectedIds}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={{ padding: spacing.xs }}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    />
  );
}

/** Skeleton loading state for the media grid — shows a 3-column grid of shimmer rectangles. */
function MediaGridSkeleton({ color }: { color: string }) {
  const { spacing } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const cellSize = (screenWidth - spacing.xs * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const placeholderBg = withAlpha(color, 0.15);

  return (
    <View style={[styles.skeletonContainer, { padding: spacing.xs }]}>
      {Array.from({ length: 12 }, (_, i) => (
        <View
          key={`skeleton-${i}`}
          style={[
            styles.skeletonCell,
            {
              width: cellSize,
              height: cellSize,
              backgroundColor: placeholderBg,
              marginEnd: (i + 1) % NUM_COLUMNS === 0 ? 0 : GRID_GAP,
              marginBottom: GRID_GAP,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridCell: {
    flex: 1,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonCell: {
    borderRadius: 4,
  },
});
