import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  Camera,
  ImageIcon,
  FileText,
  X,
  Plus,
  Paperclip,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS = 4;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Sanitize filename by stripping path separators and null bytes. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\\0]/g, '_');
}

/** Validate a file before adding it as an attachment. Returns error i18n key or null. */
export function validateReceiptFile(
  mimeType: string | null | undefined,
  fileSize: number | null | undefined,
): string | null {
  if (
    !mimeType ||
    !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
  ) {
    return 'invalidFileType';
  }
  if (fileSize != null && fileSize > MAX_FILE_SIZE_BYTES) {
    return 'fileTooLarge';
  }
  return null;
}

export interface ReceiptAttachment {
  id: string;
  uri: string;
  type: 'image' | 'document';
  name?: string;
  mimeType?: string;
  fileSize?: number;
}

interface ReceiptPickerSectionProps {
  attachments: ReceiptAttachment[];
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  onRemove: (id: string) => void;
  maxAttachments?: number;
  error?: string;
}

export function ReceiptPickerSection({
  attachments,
  onPickCamera,
  onPickGallery,
  onPickDocument,
  onRemove,
  maxAttachments = 4,
  error,
}: ReceiptPickerSectionProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(false);

  const canAdd = attachments.length < maxAttachments;

  const handlePick = useCallback(
    (picker: () => void) => {
      setSheetVisible(false);
      // Small delay for sheet dismiss animation
      setTimeout(picker, 200);
    },
    [],
  );

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerStart}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: withAlpha(colors.primary, 0.1) },
            ]}
          >
            <Paperclip size={18} color={colors.primary} />
          </View>
          <View style={{ marginStart: spacing.sm }}>
            <Text style={[typography.label, { color: colors.foreground }]}>
              {t('attachments')}
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.foregroundSecondary },
              ]}
            >
              {attachments.length}/{maxAttachments}
            </Text>
          </View>
        </View>
        {canAdd && (
          <Pressable
            onPress={() => setSheetVisible(true)}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: withAlpha(colors.green, 0.12),
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel={t('addMore')}
            testID="receipt-add-button"
          >
            <Plus size={18} color={colors.green} />
            <Text
              style={[
                typography.labelSmall,
                { color: colors.green, marginStart: spacing.xs },
              ]}
            >
              {t('add')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Grid */}
      {attachments.length > 0 ? (
        <View style={styles.grid}>
          {attachments.map((att) => (
            <View
              key={att.id}
              style={[
                styles.gridItem,
                {
                  backgroundColor: colors.muted,
                  borderRadius: radius.lg,
                  borderColor: colors.border,
                },
              ]}
            >
              {att.type === 'image' ? (
                <Image
                  source={{ uri: att.uri }}
                  style={[styles.thumbnail, { borderRadius: radius.lg }]}
                />
              ) : (
                <View style={styles.docPlaceholder}>
                  <FileText size={28} color={colors.foregroundSecondary} />
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: colors.foregroundSecondary,
                        marginTop: spacing.xs,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {att.name || t('document')}
                  </Text>
                </View>
              )}
              {/* Remove button overlay */}
              <Pressable
                onPress={() => onRemove(att.id)}
                hitSlop={6}
                style={[
                  styles.removeButton,
                  {
                    backgroundColor: colors.error,
                    borderRadius: radius.full,
                  },
                ]}
                accessibilityLabel={`Remove attachment ${att.name || att.id}`}
                testID={`receipt-remove-${att.id}`}
              >
                <X size={12} color={colors.onError} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={[
            styles.emptyState,
            {
              borderColor: colors.border,
              borderRadius: radius.lg,
              backgroundColor: withAlpha(colors.primary, 0.03),
            },
          ]}
          testID="receipt-empty-add"
        >
          <Paperclip size={24} color={colors.foregroundSecondary} />
          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.foregroundSecondary,
                marginTop: spacing.sm,
              },
            ]}
          >
            {t('addReceipts')}
          </Text>
        </Pressable>
      )}

      {/* Error */}
      {error && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, marginTop: spacing.xs },
          ]}
        >
          {error}
        </Text>
      )}

      {/* Picker bottom sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setSheetVisible(false)}
        >
          <View />
        </Pressable>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopStartRadius: radius.xl,
              borderTopEndRadius: radius.xl,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text
            style={[
              typography.headingSmall,
              {
                color: colors.foreground,
                marginBottom: spacing.lg,
                textAlign: 'center',
              },
            ]}
          >
            {t('addReceipts')}
          </Text>
          <View style={styles.sheetOptions}>
            <PickerOption
              icon={<Camera size={24} color={colors.primary} />}
              label={t('camera')}
              onPress={() => handlePick(onPickCamera)}
              colors={colors}
              typography={typography}
              spacing={spacing}
              radius={radius}
            />
            <PickerOption
              icon={<ImageIcon size={24} color={colors.secondary} />}
              label={t('gallery')}
              onPress={() => handlePick(onPickGallery)}
              colors={colors}
              typography={typography}
              spacing={spacing}
              radius={radius}
            />
            <PickerOption
              icon={<FileText size={24} color={colors.green} />}
              label={t('document')}
              onPress={() => handlePick(onPickDocument)}
              colors={colors}
              typography={typography}
              spacing={spacing}
              radius={radius}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PickerOption({
  icon,
  label,
  onPress,
  colors,
  typography: typo,
  spacing: sp,
  radius: rd,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: any;
  typography: any;
  spacing: any;
  radius: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerOption,
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.pickerIconCircle,
          {
            backgroundColor: withAlpha(colors.primary, 0.08),
            borderRadius: rd.full,
          },
        ]}
      >
        {icon}
      </View>
      <Text
        style={[
          typo.labelSmall,
          { color: colors.foregroundSecondary, marginTop: sp.xs },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerStart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
    aspectRatio: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  docPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pickerOption: {
    alignItems: 'center',
    minWidth: 80,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
