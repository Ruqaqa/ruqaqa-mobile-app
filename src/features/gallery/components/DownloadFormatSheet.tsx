import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FileDown, Droplets, Ban } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DownloadFormat } from '../types';

export type WatermarkNote = 'none' | 'mixedSelection' | 'noWatermarkedForSelection';

interface DownloadFormatSheetProps {
  visible: boolean;
  itemCount: number;
  watermarkedEnabled: boolean;
  watermarkNote: WatermarkNote;
  onSelect: (format: DownloadFormat) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for choosing download format: Original or Watermarked.
 * Mirrors Flutter's DownloadFormatSheet.
 */
export function DownloadFormatSheet({
  visible,
  itemCount,
  watermarkedEnabled,
  watermarkNote,
  onSelect,
  onClose,
}: DownloadFormatSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const noteText =
    watermarkNote === 'mixedSelection'
      ? t('downloadFormatMixedNote')
      : watermarkNote === 'noWatermarkedForSelection'
        ? t('downloadFormatNoWatermarkedNote')
        : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('downloadAs')}
      heightRatio={0.4}
    >
      <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
        {t('nItemsSelected', { count: itemCount })}
      </Text>

      {noteText && (
        <>
          <View style={{ height: spacing.sm }} />
          <Text style={[typography.bodySmall, { color: colors.foreground }]}>
            {noteText}
          </Text>
        </>
      )}

      <View style={{ height: spacing.xl }} />

      {/* Original button */}
      <Pressable
        onPress={() => onSelect('original')}
        style={({ pressed }) => [
          styles.formatButton,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('downloadOriginal')}
      >
        <FileDown size={20} color={colors.onPrimary} />
        <Text
          style={[
            typography.label,
            { color: colors.onPrimary, marginStart: spacing.sm },
          ]}
        >
          {t('downloadOriginal')}
        </Text>
      </Pressable>

      <View style={{ height: spacing.md }} />

      {/* Watermarked button */}
      <Pressable
        onPress={watermarkedEnabled ? () => onSelect('watermarked') : undefined}
        disabled={!watermarkedEnabled}
        style={({ pressed }) => [
          styles.formatButton,
          {
            backgroundColor: watermarkedEnabled ? colors.muted : colors.muted,
            borderRadius: radius.md,
            opacity: !watermarkedEnabled ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('downloadWatermarked')}
        accessibilityState={{ disabled: !watermarkedEnabled }}
      >
        <Droplets size={20} color={colors.foreground} />
        <Text
          style={[
            typography.label,
            {
              color: colors.foreground,
              marginStart: spacing.sm,
            },
          ]}
        >
          {t('downloadWatermarked')}
        </Text>
        {!watermarkedEnabled && (
          <Ban size={16} color={colors.foregroundSecondary} style={{ marginStart: spacing.sm }} />
        )}
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
});
