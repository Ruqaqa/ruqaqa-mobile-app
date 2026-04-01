import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Download, X, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { DownloadSnapshot } from '../types';

interface DownloadProgressBarProps {
  snapshot: DownloadSnapshot;
  onCancel: () => void;
  onClear: () => void;
}

/**
 * Horizontal progress bar shown at the top of the album detail screen
 * while downloads are active. Shows completed/total count, progress,
 * and failure count. Mirrors Flutter's DownloadProgressBar.
 */
export function DownloadProgressBar({
  snapshot,
  onCancel,
  onClear,
}: DownloadProgressBarProps) {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();

  // Don't render if no active downloads and no recent completions
  if (!snapshot.isActive && snapshot.totalCount === 0) return null;

  // If all done (no active), show a dismissible summary
  const allDone = !snapshot.isActive && snapshot.totalCount > 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.primary, 0.08),
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <View style={styles.row}>
        <Download size={16} color={colors.primary} />
        <View style={{ width: spacing.sm }} />
        <Text
          style={[typography.bodySmall, { color: colors.foreground, flex: 1 }]}
        >
          {allDone
            ? t('downloadComplete', {
                completed: snapshot.completedCount,
                total: snapshot.totalCount,
              })
            : t('downloadingItems', {
                completed: snapshot.completedCount,
                total: snapshot.totalCount,
              })}
        </Text>
        {snapshot.failedCount > 0 && (
          <View style={styles.failedBadge}>
            <AlertCircle size={12} color={colors.error} />
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginStart: 4 },
              ]}
            >
              {t('downloadFailed_count', { count: snapshot.failedCount })}
            </Text>
          </View>
        )}
        <View style={{ width: spacing.sm }} />
        <Pressable
          onPress={allDone ? onClear : onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={allDone ? t('done') : t('cancel')}
        >
          <X size={18} color={colors.foregroundSecondary} />
        </Pressable>
      </View>

      {snapshot.isActive && (
        <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.round(snapshot.batchProgress * 100)}%` as any,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  failedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
