import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { BulkActionProgress } from '../types';

interface BulkDeleteConfirmDialogProps {
  visible: boolean;
  itemCount: number;
  isProcessing: boolean;
  progress: BulkActionProgress | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal dialog for confirming bulk delete.
 * Two states:
 * - Confirmation: destructive warning with Cancel/Delete buttons
 * - Processing: progress indicator, undismissable
 */
export function BulkDeleteConfirmDialog({
  visible,
  itemCount,
  isProcessing,
  progress,
  onConfirm,
  onCancel,
}: BulkDeleteConfirmDialogProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isProcessing ? undefined : onCancel}
    >
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={isProcessing ? undefined : onCancel}
      >
        <View />
      </Pressable>

      {/* Dialog */}
      <View style={styles.dialogWrapper}>
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
            },
          ]}
        >
          {isProcessing ? (
            // Processing state
            <View style={styles.processingContent}>
              <ActivityIndicator size="large" color={colors.error} />
              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color: colors.foreground,
                    marginTop: spacing.base,
                    textAlign: 'center',
                  },
                ]}
              >
                {progress
                  ? t('processingItems', {
                      current: progress.completed,
                      total: progress.total,
                    })
                  : t('processingItems', { current: 0, total: itemCount })}
              </Text>
            </View>
          ) : (
            // Confirmation state
            <>
              <View style={styles.iconRow}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.rejectedBg },
                  ]}
                >
                  <AlertTriangle size={24} color={colors.error} />
                </View>
              </View>

              <Text
                style={[
                  typography.headingMedium,
                  {
                    color: colors.foreground,
                    textAlign: 'center',
                    marginTop: spacing.base,
                  },
                ]}
              >
                {t('confirmBulkDelete', { count: itemCount })}
              </Text>

              <Text
                style={[
                  typography.bodyMedium,
                  {
                    color: colors.foregroundSecondary,
                    textAlign: 'center',
                    marginTop: spacing.sm,
                  },
                ]}
              >
                {t('confirmBulkDeleteMessage')}
              </Text>

              <View
                style={[styles.buttonRow, { marginTop: spacing.xl, gap: spacing.sm }]}
              >
                <View style={styles.buttonFlex}>
                  <Button
                    title={t('cancel')}
                    onPress={onCancel}
                    variant="outline"
                    size="md"
                  />
                </View>
                <View style={styles.buttonFlex}>
                  <Button
                    title={t('deleteSelected')}
                    onPress={onConfirm}
                    variant="destructive"
                    size="md"
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialogWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  iconRow: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  buttonFlex: {
    flex: 1,
  },
});
