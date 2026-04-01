import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, Platform } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { GalleryAlbum, getLocalizedTitle } from '../types';
import { useAlbumMedia } from '../hooks/useAlbumMedia';
import { MediaGrid } from './MediaGrid';
import { FullScreenMediaViewer } from './FullScreenMediaViewer';

interface AlbumDetailScreenProps {
  album: GalleryAlbum;
  onBack: () => void;
}

/**
 * Album detail screen showing a grid of media items with full-screen viewer.
 * Replaces the Phase 5A stub with actual media browsing.
 */
export function AlbumDetailScreen({ album, onBack }: AlbumDetailScreenProps) {
  const { colors, typography, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const displayTitle = getLocalizedTitle(album, i18n.language);

  // Android back button → go back to album grid
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [onBack]);

  const {
    items,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    refresh,
    loadMore,
    retry,
  } = useAlbumMedia({ albumId: album.id });

  // Full-screen viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const handleItemPress = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const handleViewerClose = useCallback(() => {
    setViewerVisible(false);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text
          style={[typography.headingSmall, { color: colors.foreground, flex: 1 }]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
      </View>

      {/* Media grid */}
      <MediaGrid
        items={items}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isRefreshing={isRefreshing}
        error={error}
        hasMore={hasMore}
        onItemPress={handleItemPress}
        onRefresh={refresh}
        onLoadMore={loadMore}
        onRetry={retry}
      />

      {/* Full-screen media viewer */}
      <FullScreenMediaViewer
        visible={viewerVisible}
        items={items}
        initialIndex={viewerIndex}
        onClose={handleViewerClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
});
