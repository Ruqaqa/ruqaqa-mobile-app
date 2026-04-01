import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

interface SelectionHeaderProps {
  selectedCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClose: () => void;
}

/**
 * Replaces the album detail header when selection mode is active.
 * Shows: [X close] [count text] [spacer] [Select All / Deselect All]
 */
export function SelectionHeader({
  selectedCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onClose,
}: SelectionHeaderProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      {/* Close / cancel button */}
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel={t('cancel')}
      >
        <X size={24} color={colors.foreground} />
      </Pressable>

      {/* Selection count */}
      <Text
        style={[typography.label, { color: colors.foreground, flex: 1 }]}
        accessibilityLiveRegion="polite"
        numberOfLines={1}
      >
        {t('nItemsSelected', { count: selectedCount })}
      </Text>

      {/* Select All / Deselect All toggle */}
      <Pressable
        onPress={isAllSelected ? onDeselectAll : onSelectAll}
        style={styles.selectAllButton}
        accessibilityRole="button"
        accessibilityLabel={isAllSelected ? t('deselectAll') : t('selectAll')}
      >
        <Text style={[typography.button, { color: colors.primary }]}>
          {isAllSelected ? t('deselectAll') : t('selectAll')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
  selectAllButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
