import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X as XIcon,
  Search,
  Pencil,
  Trash2,
  Check,
  Plus,
  Tag as TagIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { UserPermissions } from '@/types/permissions';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PickerItem, DeleteTagResult } from '../types';
import { useTagList } from '../hooks/useTagList';
import { useTagActions } from '../hooks/useTagActions';
import { DeleteTagConfirmDialog } from './DeleteTagConfirmDialog';

interface ManageTagsScreenProps {
  visible: boolean;
  permissions: UserPermissions;
  onClose: () => void;
}

/**
 * Full-screen modal for managing gallery tags.
 *
 * Features:
 * - Search with debounce (inherited from `useTagList`).
 * - Permission-gated per-row edit/delete buttons.
 * - Inline rename (TextInput replaces label in place).
 * - Inline create (pinned row at top turns into TextInput when tapped).
 * - Delete confirm dialog with TAG_ONLY_ON_ITEMS variant.
 */
export function ManageTagsScreen({
  visible,
  permissions,
  onClose,
}: ManageTagsScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const {
    tags,
    isLoading,
    isRefreshing,
    error,
    search,
    setSearch,
    hasActiveFilters,
    refresh,
    retry,
    updateTagLocally,
    addTagLocally,
    removeTagLocally,
  } = useTagList();

  const {
    createTag,
    renameTag,
    deleteTag,
    isCreating,
    isRenaming,
    isDeleting,
  } = useTagActions();

  // --- Inline rename state ---
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // --- Inline create state ---
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [createValue, setCreateValue] = useState('');

  // --- Delete dialog state ---
  const [deleteTarget, setDeleteTarget] = useState<PickerItem | null>(null);
  const [onlyOnItemsCount, setOnlyOnItemsCount] = useState<number | null>(null);

  const handleStartRename = useCallback((tag: PickerItem) => {
    setRenameId(tag.id);
    setRenameValue(tag.name);
  }, []);

  const handleCancelRename = useCallback(() => {
    setRenameId(null);
    setRenameValue('');
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (renameId == null) return;
    const trimmed = renameValue.trim();
    if (trimmed.length === 0) return;

    const result = await renameTag(renameId, trimmed);
    if (result && result.success) {
      updateTagLocally(renameId, { name: result.tag.name });
      setRenameId(null);
      setRenameValue('');
    }
    // TAG_NAME_TAKEN and other errors: stay in rename mode so the user can edit
  }, [renameId, renameValue, renameTag, updateTagLocally]);

  const handleStartCreate = useCallback(() => {
    setIsCreatingInline(true);
    setCreateValue('');
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreatingInline(false);
    setCreateValue('');
  }, []);

  const handleSaveCreate = useCallback(async () => {
    const trimmed = createValue.trim();
    if (trimmed.length === 0) return;

    const created = await createTag(trimmed);
    if (created) {
      addTagLocally(created);
      setIsCreatingInline(false);
      setCreateValue('');
    }
  }, [createValue, createTag, addTagLocally]);

  const handleOpenDelete = useCallback((tag: PickerItem) => {
    setDeleteTarget(tag);
    setOnlyOnItemsCount(null);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setOnlyOnItemsCount(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const result: DeleteTagResult = await deleteTag(deleteTarget.id);
      if (result.success) {
        removeTagLocally(deleteTarget.id);
        setDeleteTarget(null);
        setOnlyOnItemsCount(null);
        return;
      }
      // Typed failure — handle each variant
      switch (result.code) {
        case 'TAG_ONLY_ON_ITEMS':
          // Show the warning in the same dialog
          setOnlyOnItemsCount(result.count);
          break;
        case 'TAG_DETACH_CONFLICT':
        case 'TAG_RACE_CONFLICT':
        case 'TAG_HAS_TOO_MANY_REFERENCES':
          // Close the dialog; hook's error state drives generic messaging
          setDeleteTarget(null);
          setOnlyOnItemsCount(null);
          break;
      }
    } catch {
      // Unexpected error — hook already set error state; close dialog
      setDeleteTarget(null);
      setOnlyOnItemsCount(null);
    }
  }, [deleteTarget, deleteTag, removeTagLocally]);

  // --- Render helpers ---

  const renderTagRow = useCallback(
    ({ item }: { item: PickerItem }) => {
      const isRenamingThis = renameId === item.id;

      return (
        <View
          style={[
            styles.row,
            {
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {isRenamingThis ? (
            <>
              <TagIcon
                size={18}
                color={colors.foregroundSecondary}
                style={{ marginEnd: spacing.sm }}
              />
              <TextInput
                testID={`tag-rename-input-${item.id}`}
                value={renameValue}
                onChangeText={setRenameValue}
                style={[
                  styles.rowInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.primary,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.sm,
                    fontSize: typography.bodyMedium.fontSize,
                  },
                ]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveRename}
                maxLength={100}
              />
              <Pressable
                testID={`tag-rename-save-${item.id}`}
                onPress={handleSaveRename}
                disabled={isRenaming || renameValue.trim().length === 0}
                style={[styles.iconButton, { marginStart: spacing.xs }]}
                accessibilityRole="button"
                accessibilityLabel={t('save')}
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Check size={20} color={colors.primary} />
                )}
              </Pressable>
              <Pressable
                testID={`tag-rename-cancel-${item.id}`}
                onPress={handleCancelRename}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
              >
                <XIcon size={20} color={colors.foregroundSecondary} />
              </Pressable>
            </>
          ) : (
            <>
              <TagIcon
                size={18}
                color={colors.foregroundSecondary}
                style={{ marginEnd: spacing.sm }}
              />
              <Text
                style={[
                  typography.bodyMedium,
                  { color: colors.foreground, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {permissions.canUpdateGallery && (
                <Pressable
                  testID={`tag-edit-${item.id}`}
                  onPress={() => handleStartRename(item)}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('editTag')}
                >
                  <Pencil size={18} color={colors.foreground} />
                </Pressable>
              )}
              {permissions.canDeleteGallery && (
                <Pressable
                  testID={`tag-delete-${item.id}`}
                  onPress={() => handleOpenDelete(item)}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('deleteTag')}
                >
                  <Trash2 size={18} color={colors.error} />
                </Pressable>
              )}
            </>
          )}
        </View>
      );
    },
    [
      renameId,
      renameValue,
      isRenaming,
      permissions.canUpdateGallery,
      permissions.canDeleteGallery,
      handleSaveRename,
      handleCancelRename,
      handleStartRename,
      handleOpenDelete,
      colors,
      spacing,
      radius,
      typography,
      t,
    ],
  );

  const keyExtractor = useCallback((item: PickerItem) => item.id, []);

  // Inline create row (pinned header)
  const CreateRow =
    permissions.canCreateGallery ? (
      isCreatingInline ? (
        <View
          style={[
            styles.row,
            {
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Plus
            size={18}
            color={colors.primary}
            style={{ marginEnd: spacing.sm }}
          />
          <TextInput
            testID="tag-create-input"
            value={createValue}
            onChangeText={setCreateValue}
            placeholder={t('tagNamePlaceholder')}
            placeholderTextColor={colors.foregroundSecondary}
            style={[
              styles.rowInput,
              {
                color: colors.foreground,
                borderColor: colors.primary,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                fontSize: typography.bodyMedium.fontSize,
              },
            ]}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveCreate}
            maxLength={100}
          />
          <Pressable
            testID="tag-create-save"
            onPress={handleSaveCreate}
            disabled={isCreating || createValue.trim().length === 0}
            style={[styles.iconButton, { marginStart: spacing.xs }]}
            accessibilityRole="button"
            accessibilityLabel={t('save')}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Check size={20} color={colors.primary} />
            )}
          </Pressable>
          <Pressable
            testID="tag-create-cancel"
            onPress={handleCancelCreate}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
          >
            <XIcon size={20} color={colors.foregroundSecondary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID="tag-create-trigger"
          onPress={handleStartCreate}
          style={({ pressed }) => [
            styles.row,
            {
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              borderBottomColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('createTag')}
        >
          <Plus
            size={18}
            color={colors.primary}
            style={{ marginEnd: spacing.sm }}
          />
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.primary, flex: 1, fontWeight: '500' },
            ]}
          >
            {t('createTag')}
          </Text>
        </Pressable>
      )
    ) : null;

  // --- State branches ---
  const showEmptyInitial =
    !isLoading && !error && tags.length === 0 && !hasActiveFilters;
  const showEmptyFiltered =
    !isLoading && !error && tags.length === 0 && hasActiveFilters;
  const showError = !!error && tags.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              paddingHorizontal: spacing.base,
            },
          ]}
        >
          <Pressable
            testID="manage-tags-close"
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
          >
            <XIcon size={22} color={colors.foreground} />
          </Pressable>
          <Text
            style={[
              typography.headingSmall,
              { color: colors.foreground, flex: 1, textAlign: 'center' },
            ]}
          >
            {t('manageTags')}
          </Text>
          <View style={styles.headerButton} />
        </View>

        {/* Search */}
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
          <Search
            size={18}
            color={colors.foregroundSecondary}
            style={{ marginEnd: spacing.sm }}
          />
          <TextInput
            testID="manage-tags-search"
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchTags')}
            placeholderTextColor={colors.foregroundSecondary}
            style={[
              styles.searchInput,
              {
                color: colors.foreground,
                fontSize: typography.bodyMedium.fontSize,
              },
            ]}
            returnKeyType="search"
            maxLength={200}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.headerButton}>
              <XIcon size={16} color={colors.foregroundSecondary} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        {showError ? (
          <View testID="tags-error-state" style={{ flex: 1 }}>
            <ErrorState message={t('failedToLoadTags')} onRetry={retry} />
            <Pressable
              testID="tags-retry-button"
              onPress={retry}
              accessibilityRole="button"
              style={styles.hiddenRetry}
            />
          </View>
        ) : showEmptyInitial ? (
          <View testID="tags-empty-initial" style={{ flex: 1 }}>
            {CreateRow}
            <EmptyState
              icon={<TagIcon size={48} color={colors.foregroundSecondary} />}
              title={t('noTagsYet')}
              subtitle={permissions.canCreateGallery ? t('createFirstTag') : undefined}
            />
          </View>
        ) : showEmptyFiltered ? (
          <View testID="tags-empty-filtered" style={{ flex: 1 }}>
            {CreateRow}
            <EmptyState
              icon={<Search size={48} color={colors.foregroundSecondary} />}
              title={t('noTagsFound')}
              subtitle={t('tryDifferentSearch')}
            />
          </View>
        ) : (
          <FlatList
            data={tags}
            renderItem={renderTagRow}
            keyExtractor={keyExtractor}
            ListHeaderComponent={CreateRow}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          />
        )}

        <DeleteTagConfirmDialog
          visible={deleteTarget !== null}
          tag={deleteTarget}
          isDeleting={isDeleting}
          onlyOnItemsCount={onlyOnItemsCount}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenRetry: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
