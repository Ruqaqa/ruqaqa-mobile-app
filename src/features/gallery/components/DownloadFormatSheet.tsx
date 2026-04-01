import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { FileDown, Droplets, Ban } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
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
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const noteText =
    watermarkNote === 'mixedSelection'
      ? t('downloadFormatMixedNote')
      : watermarkNote === 'noWatermarkedForSelection'
        ? t('downloadFormatNoWatermarkedNote')
        : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.xl,
            borderTopEndRadius: radius.xl,
            paddingBottom: insets.bottom || spacing.base,
            paddingHorizontal: spacing.base,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Title */}
        <Text style={[typography.headingSmall, { color: colors.foreground }]}>
          {t('downloadAs')}
        </Text>
        <View style={{ height: spacing.xs }} />
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
                flex: 1,
              },
            ]}
          >
            {t('downloadWatermarked')}
          </Text>
          {!watermarkedEnabled && (
            <Ban size={16} color={colors.foregroundSecondary} />
          )}
        </Pressable>

        <View style={{ height: spacing.sm }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
});
