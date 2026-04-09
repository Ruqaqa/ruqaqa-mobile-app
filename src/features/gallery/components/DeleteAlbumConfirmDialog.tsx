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
import { GalleryAlbum } from '../types';

interface DeleteAlbumConfirmDialogProps {
  visible: boolean;
  album: GalleryAlbum | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive confirmation dialog for deleting an album. Mirrors the visual
 * pattern of `DeleteTagConfirmDialog` and `BulkDeleteConfirmDialog` —
 * AlertTriangle icon in a rejected-bg circle, destructive variant buttons,
 * backdrop dismissible only when not deleting.
 *
 * The body text explains that items in the album will be reassigned to the
 * default album (via the backend's `beforeDelete` hook), not lost. Default
 * albums cannot reach this dialog because the caller must short-circuit on
 * `album.isDefault` before opening the sheet.
 */
export function DeleteAlbumConfirmDialog({
  visible,
  album,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteAlbumConfirmDialogProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  if (!album) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onCancel}
      testID="delete-album-confirm-dialog"
    >
      <Pressable
        style={styles.backdrop}
        onPress={isDeleting ? undefined : onCancel}
      >
        <View />
      </Pressable>

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
          {isDeleting ? (
            <View style={styles.processingContent}>
              <ActivityIndicator size="large" color={colors.error} />
            </View>
          ) : (
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
                {t('confirmDeleteAlbum', { title: album.title })}
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
                {t('confirmDeleteAlbumMessage')}
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
                    testID="delete-album-cancel-button"
                  />
                </View>
                <View style={styles.buttonFlex}>
                  <Button
                    title={t('deleteAlbum')}
                    onPress={onConfirm}
                    variant="destructive"
                    size="md"
                    testID="delete-album-confirm-button"
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
