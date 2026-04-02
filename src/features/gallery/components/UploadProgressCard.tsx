import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Circle,
  CloudUpload,
  CircleCheck,
  SkipForward,
  CircleX,
  HardDrive,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { Card } from '@/components/ui/Card';
import type {
  PipelineStatus,
  PipelineItemStatus,
  PipelineResult,
} from '../types';
import { MAX_FILE_SIZE_BYTES } from '../types';

interface UploadProgressCardProps {
  status: PipelineStatus;
  result?: PipelineResult | null;
  errorMessage?: string | null;
}

/**
 * Card showing upload pipeline progress.
 * Displays overall progress bar, per-item status rows, and result summary.
 * Mirrors Flutter's `UploadProgressCard`.
 */
export function UploadProgressCard({
  status,
  result,
  errorMessage,
}: UploadProgressCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const progressPercent = Math.round(status.progress * 100);

  return (
    <Card style={{ marginTop: spacing.base }}>
      {/* Overall progress bar */}
      <View
        style={[
          styles.progressBarTrack,
          {
            backgroundColor: withAlpha(colors.foregroundSecondary, 0.15),
            borderRadius: radius.sm,
          },
        ]}
      >
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${progressPercent}%`,
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
            },
          ]}
        />
      </View>

      {/* Percentage */}
      <Text
        style={[
          typography.bodySmall,
          {
            color: colors.foregroundSecondary,
            textAlign: 'center',
            marginTop: spacing.sm,
          },
        ]}
      >
        {progressPercent}%
      </Text>

      {/* Done count (only when >1 item) */}
      {status.totalCount > 1 && (
        <Text
          style={[
            typography.label,
            {
              color: colors.foreground,
              textAlign: 'center',
              marginTop: spacing.xs,
            },
          ]}
        >
          {t('galleryUploadDoneCount', {
            done: status.completedCount.toString(),
            total: status.totalCount.toString(),
          })}
        </Text>
      )}

      {/* Per-item status rows */}
      <View style={{ marginTop: spacing.md }}>
        {status.items.map((item, index) => (
          <ItemRow
            key={`${item.filename}-${index}`}
            item={item}
          />
        ))}
      </View>

      {/* Error message */}
      {errorMessage && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: withAlpha(colors.error, 0.1),
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typography.bodySmall, { color: colors.error }]}>
            {errorMessage}
          </Text>
        </View>
      )}

      {/* Result summary */}
      {result && <ResultSummary result={result} />}
    </Card>
  );
}

/** Per-item status row with filename and trailing status indicator. */
function ItemRow({ item }: { item: PipelineItemStatus }) {
  const { colors, typography, spacing } = useTheme();

  const isDone = item.state === 'done' || item.state === 'skipped';

  return (
    <View style={[styles.itemRow, { paddingVertical: spacing.xs }]}>
      <Text
        style={[
          typography.bodySmall,
          {
            color: isDone ? colors.foregroundSecondary : colors.foreground,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {item.filename}
      </Text>
      <View style={{ marginStart: spacing.sm }}>
        <ItemTrailing item={item} />
      </View>
    </View>
  );
}

/** Trailing icon/label for each item state. */
function ItemTrailing({ item }: { item: PipelineItemStatus }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  switch (item.state) {
    case 'waiting':
      return <Circle size={8} color={colors.foregroundSecondary} fill={colors.foregroundSecondary} />;

    case 'hashing':
    case 'checkingDuplicate':
      return (
        <View style={styles.trailingRow}>
          <ActivityIndicator size={12} color={colors.info} />
          <Text style={[styles.trailingLabel, { color: colors.info, marginStart: spacing.xs }]}>
            {t('galleryDuplicateItemHashing')}
          </Text>
        </View>
      );

    case 'optimizing':
      return (
        <View style={styles.trailingRow}>
          <ActivityIndicator size={12} color={colors.warning} />
          <Text style={[styles.trailingLabel, { color: colors.warning, marginStart: spacing.xs }]}>
            {t('galleryUploadItemOptimizing')}
          </Text>
        </View>
      );

    case 'watermarking':
      return (
        <View style={styles.trailingRow}>
          <ActivityIndicator size={12} color="#9333ea" />
          <Text style={[styles.trailingLabel, { color: '#9333ea', marginStart: spacing.xs }]}>
            {t('galleryUploadItemWatermarking')}
          </Text>
        </View>
      );

    case 'checkingSize':
      return (
        <View style={styles.trailingRow}>
          <ActivityIndicator size={12} color={colors.warning} />
          <Text style={[styles.trailingLabel, { color: colors.warning, marginStart: spacing.xs }]}>
            {t('galleryUploadItemCheckingSize')}
          </Text>
        </View>
      );

    case 'uploading':
      return (
        <View style={styles.trailingRow}>
          <CloudUpload size={14} color={colors.primary} />
          <Text style={[styles.trailingLabel, { color: colors.primary, marginStart: spacing.xs }]}>
            {t('galleryUploadItemUploading')}
          </Text>
        </View>
      );

    case 'done':
      return <CircleCheck size={16} color={colors.success} />;

    case 'skipped':
      return <SkipForward size={16} color={colors.foregroundSecondary} />;

    case 'sizeExceeded': {
      const actualMb = item.actualSizeBytes
        ? Math.round(item.actualSizeBytes / (1024 * 1024))
        : '?';
      return (
        <View style={styles.trailingRow}>
          <HardDrive size={14} color={colors.error} />
          <Text style={[styles.trailingLabel, { color: colors.error, marginStart: spacing.xs }]}>
            {actualMb} MB
          </Text>
        </View>
      );
    }

    case 'failed':
      return <CircleX size={16} color={colors.error} />;

    default:
      return null;
  }
}

/** Summary shown after pipeline completion. */
function ResultSummary({ result }: { result: PipelineResult }) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const lines: string[] = [];

  if (result.successCount > 0 && result.failedCount === 0 && result.skippedCount === 0 && result.oversizedCount === 0) {
    lines.push(t('galleryUploadSuccess'));
  } else if (result.failedCount > 0) {
    lines.push(
      t('galleryUploadPartialSuccess', {
        success: result.successCount,
        total: result.totalCount,
        failed: result.failedCount,
      }),
    );
  }

  if (result.skippedCount > 0) {
    lines.push(
      t('galleryUploadPartialSkipped', {
        success: result.successCount,
        total: result.totalCount,
        skipped: result.skippedCount,
      }),
    );
  }

  if (result.oversizedCount > 0) {
    const limitMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    lines.push(
      t('galleryUploadOversizedSkipped_other', {
        count: result.oversizedCount,
        limitMb,
      }),
    );
  }

  if (result.bytesSaved > 0) {
    const mbSaved = (result.bytesSaved / (1024 * 1024)).toFixed(1);
    lines.push(t('galleryUploadSizeSaved', { size: mbSaved }));
  }

  if (lines.length === 0) return null;

  const isAllSuccess = result.failedCount === 0 && result.oversizedCount === 0;

  return (
    <View
      style={[
        styles.resultBanner,
        {
          backgroundColor: isAllSuccess
            ? withAlpha(colors.success, 0.1)
            : withAlpha(colors.warning, 0.1),
          borderRadius: radius.md,
          padding: spacing.md,
          marginTop: spacing.md,
        },
      ]}
    >
      {lines.map((line, i) => (
        <Text
          key={i}
          style={[
            typography.bodySmall,
            {
              color: isAllSuccess ? colors.success : colors.foreground,
              marginTop: i > 0 ? spacing.xs : 0,
            },
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  progressBarTrack: {
    height: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingLabel: {
    fontSize: 11,
  },
  errorBanner: {},
  resultBanner: {},
});
