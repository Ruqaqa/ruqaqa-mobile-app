import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Search, X as XIcon, ImageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { UserPermissions } from '@/types/permissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { GalleryAlbum } from '../types';
import { useAlbumList } from '../hooks/useAlbumList';
import { AlbumCard } from './AlbumCard';
import { AlbumDetailScreen } from './AlbumDetailScreen';
import { AlbumOptionsSheet } from './AlbumOptionsSheet';
import { EditAlbumNameDialog } from './EditAlbumNameDialog';
import { CreateAlbumSheet } from './CreateAlbumSheet';

interface AlbumGridScreenProps {
  permissions: UserPermissions;
  showCreateSheet: boolean;
  onCreateSheetClose: () => void;
  onDetailVisibleChange?: (visible: boolean) => void;
}

const SKELETON_DATA = [1, 2, 3, 4, 5, 6];

export function AlbumGridScreen({
  permissions,
  showCreateSheet,
  onCreateSheetClose,
  onDetailVisibleChange,
}: AlbumGridScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  const {
    albums,
    isLoading,
    isRefreshing,
    error,
    search,
    setSearch,
    hasActiveFilters,
    refresh,
    retry,
    updateAlbumLocally,
    addAlbumLocally,
  } = useAlbumList();

  // Album detail state
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Album options state
  const [optionsAlbum, setOptionsAlbum] = useState<GalleryAlbum | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  // Edit name dialog state
  const [editAlbum, setEditAlbum] = useState<GalleryAlbum | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const handleAlbumPress = useCallback((album: GalleryAlbum) => {
    setSelectedAlbum(album);
    setDetailVisible(true);
    onDetailVisibleChange?.(true);
  }, [onDetailVisibleChange]);

  const handleAlbumLongPress = useCallback((album: GalleryAlbum) => {
    if (album.isDefault) return; // Default album cannot be renamed
    setOptionsAlbum(album);
    setOptionsVisible(true);
  }, []);

  const handleDetailBack = useCallback(() => {
    setDetailVisible(false);
    setSelectedAlbum(null);
    onDetailVisibleChange?.(false);
  }, [onDetailVisibleChange]);

  const handleOptionsClose = useCallback(() => {
    setOptionsVisible(false);
  }, []);

  const handleEditName = useCallback(() => {
    setEditAlbum(optionsAlbum);
    setEditVisible(true);
  }, [optionsAlbum]);

  const handleEditClose = useCallback(() => {
    setEditVisible(false);
    setEditAlbum(null);
  }, []);

  const handleSaved = useCallback(
    (albumId: string, newTitle: string) => {
      const isArabic = i18n.language === 'ar';
      updateAlbumLocally(albumId, isArabic
        ? { titleAr: newTitle }
        : { titleEn: newTitle },
      );
    },
    [updateAlbumLocally, i18n.language],
  );

  const handleCreated = useCallback(
    (album: GalleryAlbum) => {
      addAlbumLocally(album);
    },
    [addAlbumLocally],
  );

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, [setSearch]);

  const renderAlbumCard = useCallback(
    ({ item }: { item: GalleryAlbum }) => (
      <AlbumCard
        album={item}
        onPress={() => handleAlbumPress(item)}
        onLongPress={() => handleAlbumLongPress(item)}
      />
    ),
    [handleAlbumPress, handleAlbumLongPress],
  );

  const renderSkeletonItem = useCallback(
    () => (
      <View style={styles.skeletonItem}>
        <SkeletonCard lines={3} />
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: GalleryAlbum) => item.id, []);
  const skeletonKeyExtractor = useCallback((_: number, index: number) => `skeleton-${index}`, []);

  // Show detail screen as overlay when an album is selected
  if (detailVisible && selectedAlbum) {
    return <AlbumDetailScreen album={selectedAlbum} onBack={handleDetailBack} />;
  }

  // Loading skeleton
  const showSkeleton = isLoading && albums.length === 0;
  // Error state
  const showError = !!error && albums.length === 0 && !isLoading;
  // Empty states
  const showEmptyFiltered = albums.length === 0 && hasActiveFilters && !isLoading && !error;
  const showEmptyInitial = albums.length === 0 && !hasActiveFilters && !isLoading && !error;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.base,
          },
        ]}
      >
        <Search size={18} color={colors.foregroundSecondary} style={{ marginEnd: spacing.sm }} />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: colors.foreground,
              fontSize: typography.bodyMedium.fontSize,
            },
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('searchAlbums')}
          placeholderTextColor={colors.foregroundSecondary}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={handleClearSearch} style={styles.clearButton}>
            <XIcon size={16} color={colors.foregroundSecondary} />
          </Pressable>
        )}
      </View>

      {/* Content area */}
      {showSkeleton && (
        <FlatList
          data={SKELETON_DATA}
          renderItem={renderSkeletonItem}
          keyExtractor={skeletonKeyExtractor}
          numColumns={2}
          columnWrapperStyle={[styles.columnWrapper, { gap: spacing.md }]}
          contentContainerStyle={{ padding: spacing.base }}
        />
      )}

      {showError && (
        <ErrorState
          message={t('failedToLoadAlbums')}
          onRetry={retry}
        />
      )}

      {showEmptyFiltered && (
        <EmptyState
          icon={<Search size={48} color={colors.foregroundSecondary} />}
          title={t('noAlbumsFound')}
          subtitle={t('tryDifferentSearch')}
        />
      )}

      {showEmptyInitial && (
        <EmptyState
          icon={<ImageIcon size={48} color={colors.foregroundSecondary} />}
          title={t('noAlbumsYet')}
          subtitle={t('albumsComingSoon')}
        />
      )}

      {!showSkeleton && !showError && !showEmptyFiltered && !showEmptyInitial && (
        <FlatList
          data={albums}
          renderItem={renderAlbumCard}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={[styles.columnWrapper, { gap: spacing.md }]}
          contentContainerStyle={{ padding: spacing.base, paddingBottom: spacing.xxxl }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Bottom sheets and dialogs */}
      <CreateAlbumSheet
        visible={showCreateSheet}
        onClose={onCreateSheetClose}
        onCreated={handleCreated}
      />

      <AlbumOptionsSheet
        visible={optionsVisible}
        album={optionsAlbum}
        onClose={handleOptionsClose}
        onEditName={handleEditName}
      />

      <EditAlbumNameDialog
        visible={editVisible}
        album={editAlbum}
        onClose={handleEditClose}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: 48,
    padding: 0,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnWrapper: {
    marginBottom: 12,
  },
  skeletonItem: {
    flex: 1,
  },
});
