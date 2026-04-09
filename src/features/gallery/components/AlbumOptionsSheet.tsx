import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { UserPermissions } from '@/types/permissions';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { GalleryAlbum } from '../types';

interface AlbumOptionsSheetProps {
  visible: boolean;
  album: GalleryAlbum | null;
  permissions: UserPermissions;
  onClose: () => void;
  onEditName: () => void;
  onDelete: () => void;
}

/**
 * Bottom sheet shown on long-press of an album card. Offers rename + delete
 * actions, each gated independently on the user's gallery permissions. The
 * caller is responsible for short-circuiting before opening the sheet when
 * the user has neither permission (or when the album is the default album,
 * which cannot be deleted and, by convention, also cannot be renamed from
 * mobile).
 */
export function AlbumOptionsSheet({
  visible,
  album,
  permissions,
  onClose,
  onEditName,
  onDelete,
}: AlbumOptionsSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  const canEdit = permissions.canUpdateGallery;
  const canDelete = permissions.canDeleteGallery && !album?.isDefault;

  const handleEditPress = useCallback(() => {
    onEditName();
    onClose();
  }, [onEditName, onClose]);

  const handleDeletePress = useCallback(() => {
    onDelete();
    onClose();
  }, [onDelete, onClose]);

  if (!album) return null;

  // If neither action is available, the sheet should not have been opened.
  // Defensive null-render so we don't show an empty sheet.
  if (!canEdit && !canDelete) return null;

  const localeHint =
    i18n.language === 'ar' ? t('editingArabicName') : t('editingEnglishName');

  // Shrink the sheet when only one action is visible.
  const heightRatio = canEdit && canDelete ? 0.3 : 0.22;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('albumOptions')}
      heightRatio={heightRatio}
    >
      {canEdit && (
        <Pressable
          onPress={handleEditPress}
          style={({ pressed }) => [
            styles.optionRow,
            {
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('editAlbumName')}
          testID="album-options-edit-row"
        >
          <Pencil size={20} color={colors.foreground} style={{ marginEnd: spacing.md }} />
          <View style={styles.optionText}>
            <Text style={[typography.bodyMedium, { color: colors.foreground }]}>
              {t('editAlbumName')}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
              {localeHint}
            </Text>
          </View>
        </Pressable>
      )}

      {canDelete && (
        <Pressable
          onPress={handleDeletePress}
          style={({ pressed }) => [
            styles.optionRow,
            {
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('deleteAlbum')}
          testID="album-options-delete-row"
        >
          <Trash2 size={20} color={colors.error} style={{ marginEnd: spacing.md }} />
          <View style={styles.optionText}>
            <Text style={[typography.bodyMedium, { color: colors.error }]}>
              {t('deleteAlbum')}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
              {t('confirmDeleteAlbumMessage')}
            </Text>
          </View>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
});
