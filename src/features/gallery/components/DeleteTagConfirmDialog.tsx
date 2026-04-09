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
import { PickerItem } from '../types';

interface DeleteTagConfirmDialogProps {
  visible: boolean;
  tag: PickerItem | null;
  isDeleting: boolean;
  /** When set, shows the "tag is the only tag on N items" warning in place of the default message. */
  onlyOnItemsCount?: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive confirmation dialog for deleting a tag. Mirrors the visual
 * pattern of `BulkDeleteConfirmDialog` — AlertTriangle icon, destructive
 * variant, backdrop dismissible only when not deleting.
 *
 * When `onlyOnItemsCount` is set (TAG_ONLY_ON_ITEMS response), the body text
 * switches to the "only tag on N items" warning while the action buttons
 * remain the same — the user can still confirm (the backend allows it; the
 * warning is informational).
 */
export function DeleteTagConfirmDialog({
  visible,
  tag,
  isDeleting,
  onlyOnItemsCount,
  onConfirm,
  onCancel,
}: DeleteTagConfirmDialogProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  if (!tag) return null;

  const bodyText =
    onlyOnItemsCount != null
      ? t('tagOnlyOnItemsMessage', { count: onlyOnItemsCount })
      : t('confirmDeleteTagMessage');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onCancel}
      testID="delete-tag-confirm-dialog"
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
                {t('confirmDeleteTag', { name: tag.name })}
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
                {bodyText}
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
                    testID="delete-tag-cancel-button"
                  />
                </View>
                <View style={styles.buttonFlex}>
                  <Button
                    title={t('deleteTag')}
                    onPress={onConfirm}
                    variant="destructive"
                    size="md"
                    testID="delete-tag-confirm-button"
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
