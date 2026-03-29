import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Check, AlertCircle, FileText, ImageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadFileItem {
  id: string;
  name: string;
  type: 'image' | 'document';
  status: FileUploadStatus;
}

interface ReceiptUploadProgressProps {
  files: UploadFileItem[];
  /** Overall status message, e.g. "Uploading 2/4..." or "Saving..." */
  overallStatus: string;
  visible: boolean;
}

export function ReceiptUploadProgress({
  files,
  overallStatus,
  visible,
}: ReceiptUploadProgressProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();

  if (!visible) return null;

  const doneCount = files.filter((f) => f.status === 'done').length;
  const progress = files.length > 0 ? doneCount / files.length : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.surface, 0.97),
          borderRadius: radius.lg,
          borderColor: colors.border,
          padding: spacing.base,
        },
      ]}
    >
      {/* Overall status */}
      <Text
        style={[
          typography.label,
          { color: colors.foreground, marginBottom: spacing.sm },
        ]}
      >
        {overallStatus}
      </Text>

      {/* Progress bar */}
      <View
        style={[
          styles.progressTrack,
          {
            backgroundColor: colors.muted,
            borderRadius: radius.full,
            marginBottom: spacing.md,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.green,
              borderRadius: radius.full,
              width: `${Math.round(progress * 100)}%`,
            },
          ]}
        />
      </View>

      {/* File list */}
      {files.map((file) => (
        <View
          key={file.id}
          style={[styles.fileRow, { marginBottom: spacing.sm }]}
        >
          {/* File icon */}
          <View
            style={[
              styles.fileIcon,
              {
                backgroundColor: withAlpha(colors.primary, 0.08),
                borderRadius: radius.sm,
              },
            ]}
          >
            {file.type === 'image' ? (
              <ImageIcon size={16} color={colors.primary} />
            ) : (
              <FileText size={16} color={colors.green} />
            )}
          </View>

          {/* Filename */}
          <Text
            style={[
              typography.bodySmall,
              { color: colors.foreground, flex: 1, marginStart: spacing.sm },
            ]}
            numberOfLines={1}
          >
            {file.name}
          </Text>

          {/* Status indicator */}
          <View style={styles.statusIcon}>
            {file.status === 'pending' && (
              <View
                style={[
                  styles.pendingDot,
                  { backgroundColor: colors.foregroundSecondary },
                ]}
              />
            )}
            {file.status === 'uploading' && (
              <ActivityIndicator size={16} color={colors.primary} />
            )}
            {file.status === 'done' && (
              <Check size={16} color={colors.success} />
            )}
            {file.status === 'error' && (
              <AlertCircle size={16} color={colors.error} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    minWidth: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
