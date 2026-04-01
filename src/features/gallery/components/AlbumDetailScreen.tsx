import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, Platform } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { useAppModuleContext } from '@/navigation/AppModuleContext';
import {
  GalleryAlbum,
  getLocalizedTitle,
  ManageSheetState,
  ManageItemPayload,
  MediaItemDetail,
  CheckState,
} from '../types';
import { useAlbumMedia } from '../hooks/useAlbumMedia';
import { useMediaSelection } from '../hooks/useMediaSelection';
import { useMediaBulkActions } from '../hooks/useMediaBulkActions';
import { MediaGrid } from './MediaGrid';
import { FullScreenMediaViewer } from './FullScreenMediaViewer';
import { SelectionHeader } from './SelectionHeader';
import { SelectionActionBar } from './SelectionActionBar';
import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';
import { BulkManageSheet, type ManageSheetChanges } from './BulkManageSheet';

interface AlbumDetailScreenProps {
  album: GalleryAlbum;
  onBack: () => void;
}

/**
 * Compute ManageSheetState from fetched item details.
 * For each album/tag, determine tri-state: checked (all items), unchecked (none), mixed (some).
 */
function computeManageState(details: MediaItemDetail[]): ManageSheetState {
  if (details.length === 0) {
    return { albums: [], tags: [] };
  }

  // Collect all unique albums across all items
  const albumMap = new Map<string, { title: string; count: number }>();
  for (const detail of details) {
    for (const album of detail.albums) {
      const existing = albumMap.get(album.id);
      if (existing) {
        existing.count++;
      } else {
        albumMap.set(album.id, { title: album.title, count: 1 });
      }
    }
  }

  const albums: ManageSheetState['albums'] = [];
  for (const [id, { title, count }] of albumMap) {
    let state: CheckState;
    if (count === details.length) {
      state = 'checked';
    } else {
      state = 'mixed';
    }
    albums.push({ id, title, state });
  }

  // Collect all unique tags across all items
  const tagMap = new Map<string, { name: string; count: number }>();
  for (const detail of details) {
    for (const tag of detail.tags) {
      const existing = tagMap.get(tag.id);
      if (existing) {
        existing.count++;
      } else {
        tagMap.set(tag.id, { name: tag.name, count: 1 });
      }
    }
  }

  const tags: ManageSheetState['tags'] = [];
  for (const [id, { name, count }] of tagMap) {
    let state: CheckState;
    if (count === details.length) {
      state = 'checked';
    } else {
      state = 'mixed';
    }
    tags.push({ id, name, state });
  }

  return { albums, tags };
}

/**
 * Resolve per-item ManageItemPayload from the user's changes and the item's current state.
 * - checked → add to all items
 * - unchecked → remove from all items
 * - mixed (unchanged) → keep as-is per item
 */
function resolveManagePayload(
  itemDetail: MediaItemDetail,
  changes: ManageSheetChanges,
): ManageItemPayload {
  const currentAlbumIds = new Set(itemDetail.albums.map((a) => a.id));
  for (const change of changes.albums) {
    if (change.state === 'checked') {
      currentAlbumIds.add(change.id);
    } else if (change.state === 'unchecked') {
      currentAlbumIds.delete(change.id);
    }
    // 'mixed' → no change
  }

  const currentTagIds = new Set(itemDetail.tags.map((t) => t.id));
  for (const change of changes.tags) {
    if (change.state === 'checked') {
      currentTagIds.add(change.id);
    } else if (change.state === 'unchecked') {
      currentTagIds.delete(change.id);
    }
    // 'mixed' → no change
  }

  return {
    albumIds: [...currentAlbumIds],
    tagIds: [...currentTagIds],
  };
}

/**
 * Album detail screen showing a grid of media items with full-screen viewer.
 * Orchestrates selection mode (Phase 5C) with bulk delete and manage actions.
 */
export function AlbumDetailScreen({ album, onBack }: AlbumDetailScreenProps) {
  const { colors, typography, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const { permissions } = useAppModuleContext();
  const displayTitle = getLocalizedTitle(album, i18n.language);

  // Selection is enabled when user has at least one bulk action permission
  const canBulkAction = permissions.canUpdateGallery || permissions.canDeleteGallery;

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
    removeItemsLocally,
  } = useAlbumMedia({ albumId: album.id });

  const selection = useMediaSelection({ enabled: canBulkAction });
  const bulkActions = useMediaBulkActions();

  // Full-screen viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Bulk action dialog/sheet state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [manageState, setManageState] = useState<ManageSheetState | null>(null);

  // Cache fetched item details for per-item resolution on manage confirm
  const itemDetailsRef = useRef<MediaItemDetail[]>([]);

  // Android back button: exit selection mode first, then navigate back
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return true;
      }
      if (showManageSheet) {
        if (!bulkActions.isProcessing) {
          setShowManageSheet(false);
        }
        return true;
      }
      if (selection.isSelectionMode) {
        selection.exitSelectionMode();
        return true;
      }
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [onBack, selection, showDeleteConfirm, showManageSheet, bulkActions.isProcessing]);

  // --- Item press handlers ---

  const handleItemPress = useCallback(
    (index: number) => {
      // Suppress viewer when in selection mode
      if (selection.isSelectionMode) return;
      setViewerIndex(index);
      setViewerVisible(true);
    },
    [selection.isSelectionMode],
  );

  const handleViewerClose = useCallback(() => {
    setViewerVisible(false);
  }, []);

  // --- Selection mode handlers ---

  const handleItemLongPress = useCallback(
    (itemId: string) => {
      if (!canBulkAction) return;
      if (!selection.isSelectionMode) {
        selection.enterSelectionMode();
      }
      selection.toggleItem(itemId);
    },
    [canBulkAction, selection],
  );

  const handleItemSelect = useCallback(
    (itemId: string) => {
      selection.toggleItem(itemId);
    },
    [selection],
  );

  const handleSelectAll = useCallback(() => {
    const allIds = items.map((item) => item.id);
    selection.selectAll(allIds);
  }, [items, selection]);

  const isAllSelected = items.length > 0 && selection.selectedCount === items.length;

  // --- Bulk delete handlers ---

  const handleDeletePress = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const ids = [...selection.selectedIds];
    const result = await bulkActions.bulkDelete(ids);

    setShowDeleteConfirm(false);

    if (!result) return;

    // Optimistically remove succeeded items
    if (result.succeededIds.length > 0) {
      removeItemsLocally(result.succeededIds);
    }

    if (result.outcome === 'allSucceeded') {
      selection.exitSelectionMode();
    } else {
      // Keep failed items selected for retry — deselect succeeded ones
      for (const id of result.succeededIds) {
        selection.toggleItem(id);
      }
    }
  }, [selection, bulkActions, removeItemsLocally]);

  // --- Bulk manage handlers ---

  const handleManagePress = useCallback(async () => {
    setShowManageSheet(true);
    setManageState(null);

    const ids = [...selection.selectedIds];
    const details = await bulkActions.fetchBulkState(ids);
    itemDetailsRef.current = details;

    const state = computeManageState(details);
    setManageState(state);
  }, [selection, bulkActions]);

  const handleManageClose = useCallback(() => {
    if (!bulkActions.isProcessing) {
      setShowManageSheet(false);
      setManageState(null);
    }
  }, [bulkActions.isProcessing]);

  const handleManageConfirm = useCallback(
    async (changes: ManageSheetChanges) => {
      const details = itemDetailsRef.current;
      if (details.length === 0) return;

      // Build per-item payloads from the user's changes
      const ids: string[] = [];
      const payloads: ManageItemPayload[] = [];

      for (const detail of details) {
        const payload = resolveManagePayload(detail, changes);
        ids.push(detail.id);
        payloads.push(payload);
      }

      // Process sequentially — each item may have different resolved payload
      let succeededCount = 0;
      let failedCount = 0;

      for (let i = 0; i < ids.length; i++) {
        const result = await bulkActions.bulkManage([ids[i]], payloads[i]);
        if (result && result.outcome === 'allSucceeded') {
          succeededCount++;
        } else {
          failedCount++;
        }
      }

      setShowManageSheet(false);
      setManageState(null);

      if (failedCount === 0) {
        selection.exitSelectionMode();
        refresh();
      }
    },
    [bulkActions, selection, refresh],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — swap between normal and selection header */}
      {selection.isSelectionMode ? (
        <SelectionHeader
          selectedCount={selection.selectedCount}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAll}
          onDeselectAll={selection.deselectAll}
          onClose={selection.exitSelectionMode}
        />
      ) : (
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
            {i18n.dir() === 'rtl' ? (
              <ArrowRight size={24} color={colors.foreground} />
            ) : (
              <ArrowLeft size={24} color={colors.foreground} />
            )}
          </Pressable>
          <Text
            style={[typography.headingSmall, { color: colors.foreground, flex: 1 }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        </View>
      )}

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
        isSelectionMode={selection.isSelectionMode}
        selectedIds={selection.selectedIds}
        onItemLongPress={handleItemLongPress}
        onItemSelect={handleItemSelect}
      />

      {/* Selection action bar */}
      {selection.isSelectionMode && (
        <SelectionActionBar
          selectedCount={selection.selectedCount}
          canDelete={permissions.canDeleteGallery}
          canUpdate={permissions.canUpdateGallery}
          isProcessing={bulkActions.isProcessing}
          onDelete={handleDeletePress}
          onManage={handleManagePress}
        />
      )}

      {/* Full-screen media viewer — hidden during selection mode */}
      <FullScreenMediaViewer
        visible={viewerVisible && !selection.isSelectionMode}
        items={items}
        initialIndex={viewerIndex}
        onClose={handleViewerClose}
      />

      {/* Bulk delete confirmation dialog */}
      <BulkDeleteConfirmDialog
        visible={showDeleteConfirm}
        itemCount={selection.selectedCount}
        isProcessing={bulkActions.isProcessing}
        progress={bulkActions.progress}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Bulk manage sheet */}
      <BulkManageSheet
        visible={showManageSheet}
        selectedCount={selection.selectedCount}
        currentAlbumId={album.id}
        manageState={manageState}
        isFetchingState={bulkActions.isFetchingState}
        isProcessing={bulkActions.isProcessing}
        progress={bulkActions.progress}
        onConfirm={handleManageConfirm}
        onClose={handleManageClose}
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
