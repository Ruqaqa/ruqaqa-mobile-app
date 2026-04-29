import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Check,
  Minus,
  Search,
  PlusCircle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { withAlpha } from '@/utils/colorUtils';
import { UserPermissions } from '@/types/permissions';
import {
  CheckState,
  ManageSheetState,
  BulkActionProgress,
  GalleryAlbum,
  PickerItem,
} from '../types';

interface BulkManageSheetProps {
  visible: boolean;
  selectedCount: number;
  currentAlbumId: string;
  /**
   * Initial tri-state for albums/tags currently attached to the selected items.
   * Used as a lookup map (id → CheckState) — items not present here start as 'unchecked'.
   */
  manageState: ManageSheetState | null;
  isFetchingState: boolean;
  isProcessing: boolean;
  progress: BulkActionProgress | null;
  permissions: UserPermissions;
  /** Search the full album inventory. Empty query returns the full list. */
  searchAlbums: (query: string) => Promise<GalleryAlbum[]>;
  /** Search the full tag inventory. Empty query returns the full list. */
  searchTags: (query: string) => Promise<PickerItem[]>;
  /** Create a new album from free text. Return null on failure. */
  onCreateAlbum: (name: string) => Promise<GalleryAlbum | null>;
  /** Create a new tag from free text. Return null on failure. */
  onCreateTag: (name: string) => Promise<PickerItem | null>;
  /** Inline error message shown above the apply button. Cleared by the host. */
  errorMessage?: string | null;
  onConfirm: (changes: ManageSheetChanges) => void;
  onClose: () => void;
}

const STATE_RANK: Record<CheckState, number> = {
  checked: 0,
  mixed: 1,
  unchecked: 2,
};

/** The changes the user has made in the manage sheet. */
export interface ManageSheetChanges {
  albums: { id: string; state: CheckState }[];
  tags: { id: string; state: CheckState }[];
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Bottom sheet for bulk-managing selected media items.
 * Two sections: Albums and Tags, each search-driven against the full inventory
 * (mirrors the Upload screen's picker). Tri-state checkboxes seeded from the
 * per-item attached state (`manageState`); items not currently attached start
 * unchecked and can be cycled to checked.
 */
export function BulkManageSheet({
  visible,
  selectedCount,
  currentAlbumId,
  manageState,
  isFetchingState,
  isProcessing,
  progress,
  permissions,
  searchAlbums,
  searchTags,
  errorMessage,
  onCreateAlbum,
  onCreateTag,
  onConfirm,
  onClose,
}: BulkManageSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  // Local edits on top of the seeded state
  const [albumOverrides, setAlbumOverrides] = useState<Map<string, CheckState>>(
    new Map(),
  );
  const [tagOverrides, setTagOverrides] = useState<Map<string, CheckState>>(
    new Map(),
  );
  const [albumSearch, setAlbumSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  // Async search results
  const [albumResults, setAlbumResults] = useState<GalleryAlbum[]>([]);
  const [tagResults, setTagResults] = useState<PickerItem[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const albumDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lookup maps (id → CheckState) for albums/tags currently attached.
  const albumSeedStates = useMemo(() => {
    const map = new Map<string, CheckState>();
    if (manageState) {
      for (const a of manageState.albums) map.set(a.id, a.state);
    }
    return map;
  }, [manageState]);

  const tagSeedStates = useMemo(() => {
    const map = new Map<string, CheckState>();
    if (manageState) {
      for (const tg of manageState.tags) map.set(tg.id, tg.state);
    }
    return map;
  }, [manageState]);

  const doSearchAlbums = useCallback(
    async (q: string) => {
      setIsLoadingAlbums(true);
      try {
        const items = await searchAlbums(q);
        setAlbumResults(items);
      } catch {
        setAlbumResults([]);
      } finally {
        setIsLoadingAlbums(false);
      }
    },
    [searchAlbums],
  );

  const doSearchTags = useCallback(
    async (q: string) => {
      setIsLoadingTags(true);
      try {
        const items = await searchTags(q);
        setTagResults(items);
      } catch {
        setTagResults([]);
      } finally {
        setIsLoadingTags(false);
      }
    },
    [searchTags],
  );

  // Reset local state and fetch full lists when the sheet opens with fresh data.
  useEffect(() => {
    if (!visible || !manageState) return;
    setAlbumOverrides(new Map());
    setTagOverrides(new Map());
    setAlbumSearch('');
    setTagSearch('');
    setIsCreatingAlbum(false);
    setIsCreatingTag(false);
    doSearchAlbums('');
    doSearchTags('');
  }, [visible, manageState, doSearchAlbums, doSearchTags]);

  const handleAlbumSearchChange = useCallback(
    (text: string) => {
      setAlbumSearch(text);
      if (albumDebounceRef.current) clearTimeout(albumDebounceRef.current);
      albumDebounceRef.current = setTimeout(() => {
        doSearchAlbums(text);
      }, SEARCH_DEBOUNCE_MS);
    },
    [doSearchAlbums],
  );

  const handleTagSearchChange = useCallback(
    (text: string) => {
      setTagSearch(text);
      if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
      tagDebounceRef.current = setTimeout(() => {
        doSearchTags(text);
      }, SEARCH_DEBOUNCE_MS);
    },
    [doSearchTags],
  );

  // Resolve tri-state for a row: override > seed > unchecked.
  // Sorted: checked → mixed → unchecked, stable within group (preserves API order).
  const albumRows = useMemo(() => {
    const rows = albumResults.map((a, index) => ({
      id: a.id,
      title: a.title,
      state:
        albumOverrides.get(a.id) ??
        albumSeedStates.get(a.id) ??
        ('unchecked' as CheckState),
      _index: index,
    }));
    rows.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a._index - b._index);
    return rows;
  }, [albumResults, albumOverrides, albumSeedStates]);

  const tagRows = useMemo(() => {
    const rows = tagResults.map((tg, index) => ({
      id: tg.id,
      name: tg.name,
      state:
        tagOverrides.get(tg.id) ??
        tagSeedStates.get(tg.id) ??
        ('unchecked' as CheckState),
      _index: index,
    }));
    rows.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a._index - b._index);
    return rows;
  }, [tagResults, tagOverrides, tagSeedStates]);

  // --- Inline create visibility ---
  const showCreateAlbumRow = useMemo(() => {
    if (!permissions.canCreateGallery) return false;
    const trimmed = albumSearch.trim();
    if (trimmed.length === 0) return false;
    const q = trimmed.toLowerCase();
    return !albumResults.some((a) => a.title.toLowerCase() === q);
  }, [permissions.canCreateGallery, albumSearch, albumResults]);

  const showCreateTagRow = useMemo(() => {
    if (!permissions.canCreateGallery) return false;
    const trimmed = tagSearch.trim();
    if (trimmed.length === 0) return false;
    const q = trimmed.toLowerCase();
    return !tagResults.some((tg) => tg.name.toLowerCase() === q);
  }, [permissions.canCreateGallery, tagSearch, tagResults]);

  const handleCreateAlbum = useCallback(async () => {
    if (isCreatingAlbum) return;
    const trimmed = albumSearch.trim();
    if (trimmed.length === 0) return;

    setIsCreatingAlbum(true);
    try {
      const created = await onCreateAlbum(trimmed);
      if (created) {
        setAlbumResults((prev) => {
          if (prev.some((a) => a.id === created.id)) return prev;
          return [created, ...prev];
        });
        setAlbumOverrides((prev) => {
          const next = new Map(prev);
          next.set(created.id, 'checked');
          return next;
        });
        setAlbumSearch('');
        doSearchAlbums('');
      }
    } finally {
      setIsCreatingAlbum(false);
    }
  }, [albumSearch, onCreateAlbum, isCreatingAlbum, doSearchAlbums]);

  const handleCreateTag = useCallback(async () => {
    if (isCreatingTag) return;
    const trimmed = tagSearch.trim();
    if (trimmed.length === 0) return;

    setIsCreatingTag(true);
    try {
      const created = await onCreateTag(trimmed);
      if (created) {
        setTagResults((prev) => {
          if (prev.some((tg) => tg.id === created.id)) return prev;
          return [created, ...prev];
        });
        setTagOverrides((prev) => {
          const next = new Map(prev);
          next.set(created.id, 'checked');
          return next;
        });
        setTagSearch('');
        doSearchTags('');
      }
    } finally {
      setIsCreatingTag(false);
    }
  }, [tagSearch, onCreateTag, isCreatingTag, doSearchTags]);

  const hasChanges = albumOverrides.size > 0 || tagOverrides.size > 0;

  const toggleAlbum = useCallback(
    (id: string) => {
      setAlbumOverrides((prev) => {
        const next = new Map(prev);
        const original = albumSeedStates.get(id) ?? 'unchecked';
        const current = next.get(id) ?? original;
        const newState = cycleCheckState(current);
        if (newState === original) {
          next.delete(id);
        } else {
          next.set(id, newState);
        }
        return next;
      });
    },
    [albumSeedStates],
  );

  const toggleTag = useCallback(
    (id: string) => {
      setTagOverrides((prev) => {
        const next = new Map(prev);
        const original = tagSeedStates.get(id) ?? 'unchecked';
        const current = next.get(id) ?? original;
        const newState = cycleCheckState(current);
        if (newState === original) {
          next.delete(id);
        } else {
          next.set(id, newState);
        }
        return next;
      });
    },
    [tagSeedStates],
  );

  const handleConfirm = useCallback(() => {
    const albumChanges = Array.from(albumOverrides.entries()).map(
      ([id, state]) => ({ id, state }),
    );
    const tagChanges = Array.from(tagOverrides.entries()).map(
      ([id, state]) => ({ id, state }),
    );
    onConfirm({ albums: albumChanges, tags: tagChanges });
  }, [albumOverrides, tagOverrides, onConfirm]);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={t('manageNItems', { count: selectedCount })}
      heightRatio={0.75}
    >
      {isFetchingState ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.foregroundSecondary,
                marginTop: spacing.base,
                textAlign: 'center',
              },
            ]}
          >
            {t('loadingItemDetails')}
          </Text>
        </View>
      ) : isProcessing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.foreground,
                marginTop: spacing.base,
                textAlign: 'center',
              },
            ]}
          >
            {progress
              ? t('processingItems', {
                  current: progress.completed,
                  total: progress.total,
                })
              : t('processingItems', { current: 0, total: selectedCount })}
          </Text>
        </View>
      ) : (
        <>
          {/* Albums section */}
          <SectionLabel label={t('manageAlbums')} colors={colors} typography={typography} spacing={spacing} />
          <SearchBar
            testID="bulk-manage-album-search"
            value={albumSearch}
            onChangeText={handleAlbumSearchChange}
            placeholder={t('gallerySearchAlbumsHint')}
            colors={colors}
            typography={typography}
            spacing={spacing}
            radius={radius}
          />
          <View style={{ marginBottom: spacing.lg }}>
            {showCreateAlbumRow && (
              <CreateRow
                testID="bulk-manage-create-album"
                query={albumSearch.trim()}
                label={t('galleryCreateAlbumAs', { query: albumSearch.trim() })}
                isCreating={isCreatingAlbum}
                disabled={isProcessing}
                onPress={handleCreateAlbum}
                colors={colors}
                typography={typography}
                spacing={spacing}
                radius={radius}
              />
            )}
            {isLoadingAlbums ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
              />
            ) : albumRows.length === 0 && !showCreateAlbumRow ? (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.foregroundSecondary, paddingVertical: spacing.sm },
                ]}
              >
                {t('galleryNoAlbumsFound')}
              </Text>
            ) : (
              albumRows.map((album) => (
                <TriStateRow
                  key={album.id}
                  label={album.title}
                  state={album.state}
                  isCurrentAlbum={album.id === currentAlbumId}
                  onToggle={() => toggleAlbum(album.id)}
                  disabled={isProcessing}
                  colors={colors}
                  typography={typography}
                  spacing={spacing}
                />
              ))
            )}
          </View>

          {/* Tags section */}
          <SectionLabel label={t('manageTagsRequired')} colors={colors} typography={typography} spacing={spacing} />
          <SearchBar
            testID="bulk-manage-tag-search"
            value={tagSearch}
            onChangeText={handleTagSearchChange}
            placeholder={t('gallerySearchTagsHint')}
            colors={colors}
            typography={typography}
            spacing={spacing}
            radius={radius}
          />
          <View style={{ marginBottom: spacing.lg }}>
            {showCreateTagRow && (
              <CreateRow
                testID="bulk-manage-create-tag"
                query={tagSearch.trim()}
                label={t('galleryCreateTagAs', { query: tagSearch.trim() })}
                isCreating={isCreatingTag}
                disabled={isProcessing}
                onPress={handleCreateTag}
                colors={colors}
                typography={typography}
                spacing={spacing}
                radius={radius}
              />
            )}
            {isLoadingTags ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
              />
            ) : tagRows.length === 0 && !showCreateTagRow ? (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.foregroundSecondary, paddingVertical: spacing.sm },
                ]}
              >
                {t('galleryNoTagsFound')}
              </Text>
            ) : (
              tagRows.map((tag) => (
                <TriStateRow
                  key={tag.id}
                  label={tag.name}
                  state={tag.state}
                  onToggle={() => toggleTag(tag.id)}
                  disabled={isProcessing}
                  colors={colors}
                  typography={typography}
                  spacing={spacing}
                />
              ))
            )}
          </View>

          {errorMessage ? (
            <View
              testID="bulk-manage-error"
              style={[
                styles.errorBanner,
                {
                  backgroundColor: withAlpha(colors.error, 0.1),
                  borderColor: withAlpha(colors.error, 0.3),
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error },
                ]}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.sm }}>
            <Button
              title={t('applyChanges', { count: selectedCount })}
              onPress={handleConfirm}
              variant="default"
              size="lg"
              disabled={!hasChanges || isProcessing}
              loading={isProcessing}
              testID="bulk-manage-confirm"
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function cycleCheckState(current: CheckState): CheckState {
  switch (current) {
    case 'unchecked':
      return 'checked';
    case 'checked':
      return 'unchecked';
    case 'mixed':
      return 'checked';
  }
}

function SectionLabel({
  label,
  colors,
  typography,
  spacing,
}: {
  label: string;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <Text
      style={[
        typography.label,
        {
          color: colors.foreground,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function SearchBar({
  testID,
  value,
  onChangeText,
  placeholder,
  colors,
  typography,
  spacing,
  radius,
}: {
  testID?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: any;
  typography: any;
  spacing: any;
  radius: any;
}) {
  return (
    <View
      style={[
        styles.searchRow,
        {
          backgroundColor: colors.muted,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <Search size={16} color={colors.foregroundSecondary} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.foregroundSecondary}
        style={[
          styles.searchInput,
          {
            color: colors.foreground,
            fontSize: typography.bodyMedium.fontSize,
            marginStart: spacing.sm,
          },
        ]}
        autoCorrect={false}
      />
    </View>
  );
}

function CreateRow({
  testID,
  query,
  label,
  isCreating,
  disabled,
  onPress,
  colors,
  typography,
  spacing,
  radius,
}: {
  testID?: string;
  query: string;
  label: string;
  isCreating: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: any;
  typography: any;
  spacing: any;
  radius: any;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={isCreating || disabled ? undefined : onPress}
      disabled={isCreating || disabled}
      style={({ pressed }) => [
        styles.createRow,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xs,
          backgroundColor: withAlpha(colors.primary, 0.06),
          borderRadius: radius.sm,
          marginBottom: spacing.xs,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isCreating ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <PlusCircle size={20} color={colors.primary} />
      )}
      <Text
        style={[
          typography.bodyMedium,
          {
            color: colors.primary,
            fontWeight: '500',
            marginStart: spacing.md,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TriStateRow({
  label,
  state,
  isCurrentAlbum,
  onToggle,
  disabled,
  colors,
  typography,
  spacing,
}: {
  label: string;
  state: CheckState;
  isCurrentAlbum?: boolean;
  onToggle: () => void;
  disabled: boolean;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.triStateRow,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xs,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === 'checked' ? true : state === 'mixed' ? 'mixed' : false }}
      accessibilityLabel={label}
    >
      <TriStateCheckbox state={state} colors={colors} />
      <Text
        style={[
          typography.bodyMedium,
          {
            color: colors.foreground,
            flex: 1,
            marginStart: spacing.md,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {isCurrentAlbum && (
        <Text
          style={[
            typography.labelSmall,
            { color: colors.foregroundSecondary },
          ]}
        >
          {'•'}
        </Text>
      )}
    </Pressable>
  );
}

function TriStateCheckbox({
  state,
  colors,
}: {
  state: CheckState;
  colors: any;
}) {
  const bgColor =
    state === 'checked'
      ? colors.green
      : state === 'mixed'
        ? withAlpha(colors.green, 0.5)
        : 'transparent';
  const borderColor =
    state === 'unchecked' ? colors.foregroundSecondary : colors.green;

  return (
    <View
      style={[
        styles.checkboxBox,
        {
          backgroundColor: bgColor,
          borderColor,
        },
      ]}
    >
      {state === 'checked' && <Check size={14} color="#ffffff" />}
      {state === 'mixed' && <Minus size={14} color="#ffffff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  searchRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 36,
    padding: 0,
  },
  triStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    borderWidth: 1,
  },
});
