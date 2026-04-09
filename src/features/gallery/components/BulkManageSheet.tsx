import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Check,
  Minus,
  Square,
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
  manageState: ManageSheetState | null;
  isFetchingState: boolean;
  isProcessing: boolean;
  progress: BulkActionProgress | null;
  permissions: UserPermissions;
  /** Create a new album from free text. Return null on failure. */
  onCreateAlbum: (name: string) => Promise<GalleryAlbum | null>;
  /** Create a new tag from free text. Return null on failure. */
  onCreateTag: (name: string) => Promise<PickerItem | null>;
  onConfirm: (changes: ManageSheetChanges) => void;
  onClose: () => void;
}

/** The changes the user has made in the manage sheet. */
export interface ManageSheetChanges {
  albums: { id: string; state: CheckState }[];
  tags: { id: string; state: CheckState }[];
}

/**
 * Bottom sheet for bulk-managing selected media items.
 * Three sections: Albums (tri-state checkboxes), Tags (tri-state checkboxes), Project (future).
 * Shows loading state while fetching current item states.
 * Shows progress during processing.
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
  onCreateAlbum,
  onCreateTag,
  onConfirm,
  onClose,
}: BulkManageSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  // Local edits on top of the fetched state
  const [albumOverrides, setAlbumOverrides] = useState<
    Map<string, CheckState>
  >(new Map());
  const [tagOverrides, setTagOverrides] = useState<Map<string, CheckState>>(
    new Map(),
  );
  const [albumSearch, setAlbumSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  // Locally-created rows (appended on top of manageState after inline create)
  const [extraAlbums, setExtraAlbums] = useState<
    { id: string; title: string }[]
  >([]);
  const [extraTags, setExtraTags] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Reset local state when the sheet opens with fresh data
  React.useEffect(() => {
    if (visible && manageState) {
      setAlbumOverrides(new Map());
      setTagOverrides(new Map());
      setAlbumSearch('');
      setTagSearch('');
      setExtraAlbums([]);
      setExtraTags([]);
      setIsCreatingAlbum(false);
      setIsCreatingTag(false);
    }
  }, [visible, manageState]);

  // Merge fetched state + locally-created rows with local overrides
  const albumRows = useMemo(() => {
    if (!manageState) return [];
    const base = manageState.albums.map((a) => ({
      ...a,
      state: albumOverrides.get(a.id) ?? a.state,
    }));
    const extras = extraAlbums.map((a) => ({
      id: a.id,
      title: a.title,
      state: (albumOverrides.get(a.id) ?? 'unchecked') as CheckState,
    }));
    return [...extras, ...base];
  }, [manageState, albumOverrides, extraAlbums]);

  const tagRows = useMemo(() => {
    if (!manageState) return [];
    const base = manageState.tags.map((tg) => ({
      ...tg,
      state: tagOverrides.get(tg.id) ?? tg.state,
    }));
    const extras = extraTags.map((tg) => ({
      id: tg.id,
      name: tg.name,
      state: (tagOverrides.get(tg.id) ?? 'unchecked') as CheckState,
    }));
    return [...extras, ...base];
  }, [manageState, tagOverrides, extraTags]);

  // Filter by search
  const filteredAlbums = useMemo(() => {
    if (!albumSearch.trim()) return albumRows;
    const q = albumSearch.trim().toLowerCase();
    return albumRows.filter((a) => a.title.toLowerCase().includes(q));
  }, [albumRows, albumSearch]);

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tagRows;
    const q = tagSearch.trim().toLowerCase();
    return tagRows.filter((tg) => tg.name.toLowerCase().includes(q));
  }, [tagRows, tagSearch]);

  // --- Inline create visibility ---
  // Show the create-album row when: user can create, search is non-empty,
  // and no existing album matches the query exactly (case-insensitive).
  const showCreateAlbumRow = useMemo(() => {
    if (!permissions.canCreateGallery) return false;
    const trimmed = albumSearch.trim();
    if (trimmed.length === 0) return false;
    const q = trimmed.toLowerCase();
    return !albumRows.some((a) => a.title.toLowerCase() === q);
  }, [permissions.canCreateGallery, albumSearch, albumRows]);

  const showCreateTagRow = useMemo(() => {
    if (!permissions.canCreateGallery) return false;
    const trimmed = tagSearch.trim();
    if (trimmed.length === 0) return false;
    const q = trimmed.toLowerCase();
    return !tagRows.some((tg) => tg.name.toLowerCase() === q);
  }, [permissions.canCreateGallery, tagSearch, tagRows]);

  const handleCreateAlbum = useCallback(async () => {
    if (isCreatingAlbum) return;
    const trimmed = albumSearch.trim();
    if (trimmed.length === 0) return;

    setIsCreatingAlbum(true);
    try {
      const created = await onCreateAlbum(trimmed);
      if (created) {
        setExtraAlbums((prev) => [
          ...prev,
          { id: created.id, title: created.title },
        ]);
        setAlbumOverrides((prev) => {
          const next = new Map(prev);
          next.set(created.id, 'checked');
          return next;
        });
        setAlbumSearch('');
      }
    } finally {
      setIsCreatingAlbum(false);
    }
  }, [albumSearch, onCreateAlbum, isCreatingAlbum]);

  const handleCreateTag = useCallback(async () => {
    if (isCreatingTag) return;
    const trimmed = tagSearch.trim();
    if (trimmed.length === 0) return;

    setIsCreatingTag(true);
    try {
      const created = await onCreateTag(trimmed);
      if (created) {
        setExtraTags((prev) => [
          ...prev,
          { id: created.id, name: created.name },
        ]);
        setTagOverrides((prev) => {
          const next = new Map(prev);
          next.set(created.id, 'checked');
          return next;
        });
        setTagSearch('');
      }
    } finally {
      setIsCreatingTag(false);
    }
  }, [tagSearch, onCreateTag, isCreatingTag]);

  // Check if any changes were made
  const hasChanges = albumOverrides.size > 0 || tagOverrides.size > 0;

  const toggleAlbum = useCallback(
    (id: string) => {
      setAlbumOverrides((prev) => {
        const next = new Map(prev);
        const original =
          manageState?.albums.find((a) => a.id === id)?.state ?? 'unchecked';
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
    [manageState],
  );

  const toggleTag = useCallback(
    (id: string) => {
      setTagOverrides((prev) => {
        const next = new Map(prev);
        const original =
          manageState?.tags.find((tg) => tg.id === id)?.state ?? 'unchecked';
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
    [manageState],
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
        // Loading state
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
        // Processing state
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
            onChangeText={setAlbumSearch}
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
            {filteredAlbums.length === 0 && !showCreateAlbumRow ? (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.foregroundSecondary, paddingVertical: spacing.sm },
                ]}
              >
                {t('galleryNoAlbumsFound')}
              </Text>
            ) : (
              filteredAlbums.map((album) => (
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
          <SectionLabel label={t('manageTags')} colors={colors} typography={typography} spacing={spacing} />
          <SearchBar
            testID="bulk-manage-tag-search"
            value={tagSearch}
            onChangeText={setTagSearch}
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
            {filteredTags.length === 0 && !showCreateTagRow ? (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.foregroundSecondary, paddingVertical: spacing.sm },
                ]}
              >
                {t('galleryNoTagsFound')}
              </Text>
            ) : (
              filteredTags.map((tag) => (
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

          {/* Confirm button */}
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

// --- Helper: cycle tri-state ---

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

// --- Sub-components (internal, not exported) ---

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
          {'\u2022'}
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
});
