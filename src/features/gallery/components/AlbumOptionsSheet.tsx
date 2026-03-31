import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { GalleryAlbum } from '../types';

interface AlbumOptionsSheetProps {
  visible: boolean;
  album: GalleryAlbum | null;
  onClose: () => void;
  onEditName: () => void;
}

export function AlbumOptionsSheet({
  visible,
  album,
  onClose,
  onEditName,
}: AlbumOptionsSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  const handleEditPress = useCallback(() => {
    onEditName();
    onClose();
  }, [onEditName, onClose]);

  if (!album) return null;

  const localeHint =
    i18n.language === 'ar' ? t('editingArabicName') : t('editingEnglishName');

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('albumOptions')} heightRatio={0.25}>
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
