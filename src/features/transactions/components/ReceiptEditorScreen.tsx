import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { tokenStorage } from '@/services/tokenStorage';
import { config } from '@/services/config';
import { Button } from '@/components/ui/Button';
import { TransactionReceipt } from '../types';
import {
  ReceiptPickerSection,
  ReceiptAttachment,
  validateReceiptFile,
  sanitizeFilename,
  MAX_ATTACHMENTS,
} from './ReceiptPickerSection';
import { EditableReceiptGrid } from './EditableReceiptGrid';
import {
  ReceiptUploadProgress,
  UploadFileItem,
} from './ReceiptUploadProgress';

export type ReceiptEditorMode = 'add' | 'edit';

interface ReceiptEditorScreenProps {
  visible: boolean;
  mode: ReceiptEditorMode;
  transactionId: string;
  existingReceipts: TransactionReceipt[];
  onClose: () => void;
  /** Called when save completes successfully. Passes the updated receipts. */
  onSaveComplete: (updatedReceipts: TransactionReceipt[]) => void;
  /** Upload new files. Returns the created receipt objects. */
  onUploadFiles: (
    transactionId: string,
    files: ReceiptAttachment[],
  ) => Promise<TransactionReceipt[]>;
  /** Remove existing receipts. */
  onRemoveReceipts?: (
    transactionId: string,
    receiptIds: string[],
  ) => Promise<void>;
}

function buildReceiptUrl(receipt: TransactionReceipt): string {
  return `${config.apiBaseUrl}/api/mobile/receipts/file/${receipt.id}`;
}

export function ReceiptEditorScreen({
  visible,
  mode,
  transactionId,
  existingReceipts,
  onClose,
  onSaveComplete,
  onUploadFiles,
  onRemoveReceipts,
}: ReceiptEditorScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  // Auth token for loading existing receipt images
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      tokenStorage.getAccessToken().then(setToken);
    }
  }, [visible]);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  // --- State ---
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(
    new Set(),
  );
  const [newAttachments, setNewAttachments] = useState<ReceiptAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setMarkedForDeletion(new Set());
      setNewAttachments([]);
      setIsSaving(false);
      setUploadFiles([]);
      setUploadStatus('');
    }
  }, [visible]);

  // Max new attachments allowed
  const remainingSlots = MAX_ATTACHMENTS - existingReceipts.length + markedForDeletion.size;
  const canAddMore = newAttachments.length < Math.max(0, remainingSlots);

  // --- Handlers ---

  const handleToggleDelete = useCallback((id: string) => {
    setMarkedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addAttachment = useCallback(
    (
      uri: string,
      type: 'image' | 'document',
      name?: string,
      mimeType?: string,
      fileSize?: number,
    ) => {
      const error = validateReceiptFile(mimeType, fileSize);
      if (error) {
        Alert.alert(t('error'), t(error));
        return;
      }
      setNewAttachments((prev) => [
        ...prev,
        {
          id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          uri,
          type,
          name: name ? sanitizeFilename(name) : undefined,
          mimeType,
          fileSize,
        },
      ]);
    },
    [t],
  );

  const removeNewAttachment = useCallback((id: string) => {
    setNewAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // --- Picker handlers (mirrors TransactionFormScreen pattern) ---

  const handlePickCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('permissionRequired'),
        t('pleaseAllowAccess', { permissionName: t('camera') }),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      addAttachment(
        asset.uri,
        'image',
        asset.fileName ?? `photo_${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
        asset.fileSize ?? undefined,
      );
    }
  }, [addAttachment, t]);

  const handlePickGallery = useCallback(async () => {
    const maxSelect = Math.max(1, remainingSlots - newAttachments.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: maxSelect,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        addAttachment(
          asset.uri,
          'image',
          asset.fileName ?? `image_${Date.now()}.jpg`,
          asset.mimeType ?? 'image/jpeg',
          asset.fileSize ?? undefined,
        );
      }
    }
  }, [addAttachment, remainingSlots, newAttachments.length]);

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      multiple: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        addAttachment(
          asset.uri,
          'document',
          asset.name,
          asset.mimeType ?? 'application/pdf',
          asset.size ?? undefined,
        );
      }
    }
  }, [addAttachment]);

  // --- Save ---

  const hasChanges = useMemo(() => {
    return newAttachments.length > 0 || markedForDeletion.size > 0;
  }, [newAttachments.length, markedForDeletion.size]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);

    // Build upload file items for progress tracking
    const fileItems: UploadFileItem[] = newAttachments.map((att) => ({
      id: att.id,
      name: att.name || 'file',
      type: att.type,
      status: 'pending' as const,
    }));
    setUploadFiles(fileItems);

    try {
      // Step 1: Remove marked receipts (full-edit mode only)
      if (markedForDeletion.size > 0 && onRemoveReceipts) {
        setUploadStatus(t('receiptEditorRemoving'));
        await onRemoveReceipts(transactionId, Array.from(markedForDeletion));
      }

      // Step 2: Upload new files
      let newReceipts: TransactionReceipt[] = [];
      if (newAttachments.length > 0) {
        // Mark all as uploading
        setUploadFiles((prev) =>
          prev.map((f) => ({ ...f, status: 'uploading' as const })),
        );
        setUploadStatus(
          t('receiptEditorUploading', {
            current: 0,
            total: newAttachments.length,
          }),
        );

        try {
          newReceipts = await onUploadFiles(transactionId, newAttachments);
          // Mark all as done
          setUploadFiles((prev) =>
            prev.map((f) => ({ ...f, status: 'done' as const })),
          );
        } catch {
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.status !== 'done' ? { ...f, status: 'error' as const } : f,
            ),
          );
          throw new Error(t('receiptUploadFailed'));
        }
      }

      setUploadStatus(t('receiptEditorSaving'));

      // Build final receipt list
      const remainingExisting = existingReceipts.filter(
        (r) => !markedForDeletion.has(r.id),
      );
      const updatedReceipts = [...remainingExisting, ...newReceipts];

      setUploadStatus(t('done'));
      // Brief delay to show "Done!" status
      await new Promise((resolve) => setTimeout(resolve, 400));

      onSaveComplete(updatedReceipts);
      onClose();
    } catch (err: any) {
      Alert.alert(t('error'), err?.message || t('errorUnknown'));
    } finally {
      setIsSaving(false);
    }
  }, [
    hasChanges,
    newAttachments,
    markedForDeletion,
    transactionId,
    existingReceipts,
    onUploadFiles,
    onRemoveReceipts,
    onSaveComplete,
    onClose,
    t,
  ]);

  if (!visible) return null;

  const isEditMode = mode === 'edit';
  const title = isEditMode ? t('editReceipts') : t('addReceipts');
  const deleteCount = markedForDeletion.size;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.backBtn}
            disabled={isSaving}
          >
            <ChevronLeft size={24} color={colors.foreground} />
          </Pressable>
          <Text
            style={[
              typography.headingSmall,
              {
                color: colors.foreground,
                flex: 1,
                textAlign: 'center',
              },
            ]}
          >
            {title}
          </Text>
          {/* Spacer for centering */}
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { padding: spacing.base },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Existing receipts section */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text
              style={[
                typography.headingSmall,
                {
                  color: colors.foreground,
                  marginBottom: spacing.md,
                },
              ]}
            >
              {t('receiptEditorExisting')}
            </Text>

            {isEditMode && deleteCount > 0 && (
              <View
                style={[
                  styles.deletionBanner,
                  {
                    backgroundColor: withAlpha(colors.error, 0.1),
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.error },
                  ]}
                >
                  {t('receiptEditorMarkedForRemoval', { count: deleteCount })}
                </Text>
              </View>
            )}

            <EditableReceiptGrid
              receipts={existingReceipts}
              markedForDeletion={markedForDeletion}
              onToggleDelete={handleToggleDelete}
              editable={isEditMode}
              authHeaders={authHeaders}
              buildUrl={buildReceiptUrl}
            />
          </View>

          {/* New attachments section */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text
              style={[
                typography.headingSmall,
                {
                  color: colors.foreground,
                  marginBottom: spacing.md,
                },
              ]}
            >
              {t('receiptEditorNewAttachments')}
            </Text>

            <ReceiptPickerSection
              attachments={newAttachments}
              onPickCamera={handlePickCamera}
              onPickGallery={handlePickGallery}
              onPickDocument={handlePickDocument}
              onRemove={removeNewAttachment}
              maxAttachments={Math.max(1, remainingSlots)}
            />
          </View>

          {/* Upload progress (shown during save) */}
          <ReceiptUploadProgress
            files={uploadFiles}
            overallStatus={uploadStatus}
            visible={isSaving}
          />

          {/* Bottom spacer for fixed button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed save button */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              ...shadows.md,
            },
          ]}
        >
          <Button
            title={
              isSaving
                ? t('receiptEditorSaving')
                : t('receiptEditorSave')
            }
            onPress={handleSave}
            variant="gradient"
            size="lg"
            disabled={isSaving || !hasChanges}
            loading={isSaving}
            testID="receipt-editor-save"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  deletionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
