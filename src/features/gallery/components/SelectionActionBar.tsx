import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trash2, FolderCog, Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

interface SelectionActionBarProps {
  selectedCount: number;
  canDelete: boolean;
  canUpdate: boolean;
  canDownload?: boolean;
  isProcessing: boolean;
  onDelete: () => void;
  onManage: () => void;
  onDownload?: () => void;
}

/**
 * Fixed bottom bar with bulk action buttons (Manage, Delete).
 * Shown when selection mode is active.
 */
export function SelectionActionBar({
  selectedCount,
  canDelete,
  canUpdate,
  canDownload,
  isProcessing,
  onDelete,
  onManage,
  onDownload,
}: SelectionActionBarProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const isDisabled = isProcessing || selectedCount === 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom || spacing.sm,
          paddingHorizontal: spacing.base,
        },
      ]}
    >
      <View style={styles.buttonRow}>
        {canDownload && onDownload && (
          <Pressable
            onPress={onDownload}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('downloadSelected')}
            accessibilityState={{ disabled: isDisabled }}
          >
            <Download size={20} color={colors.green} />
            <Text
              style={[
                typography.labelSmall,
                { color: colors.green, marginTop: spacing.xxs },
              ]}
            >
              {t('downloadSelected')}
            </Text>
          </Pressable>
        )}

        {canUpdate && (
          <Pressable
            onPress={onManage}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('manageSelected')}
            accessibilityState={{ disabled: isDisabled }}
          >
            <FolderCog size={20} color={colors.primary} />
            <Text
              style={[
                typography.labelSmall,
                { color: colors.primary, marginTop: spacing.xxs },
              ]}
            >
              {t('manageSelected')}
            </Text>
          </Pressable>
        )}

        {canDelete && (
          <Pressable
            onPress={onDelete}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('deleteSelected')}
            accessibilityState={{ disabled: isDisabled }}
          >
            <Trash2 size={20} color={colors.error} />
            <Text
              style={[
                typography.labelSmall,
                { color: colors.error, marginTop: spacing.xxs },
              ]}
            >
              {t('deleteSelected')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    height: 56,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 44,
  },
});
