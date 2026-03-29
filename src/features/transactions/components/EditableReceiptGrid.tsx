import React, { useCallback } from 'react';
import { View, Image, Text, Pressable, StyleSheet } from 'react-native';
import { FileText, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { TransactionReceipt } from '../types';

interface EditableReceiptGridProps {
  receipts: TransactionReceipt[];
  /** IDs of receipts marked for deletion */
  markedForDeletion: Set<string>;
  /** Toggle delete mark on a receipt. Only called in full-edit mode. */
  onToggleDelete: (id: string) => void;
  /** Whether the grid is interactive (full-edit) or read-only (add-only) */
  editable: boolean;
  /** Auth headers for loading receipt images */
  authHeaders?: Record<string, string>;
  /** Build full URL for a receipt */
  buildUrl: (receipt: TransactionReceipt) => string;
}

/** Infer mimeType from receipt data */
function inferMimeType(receipt: TransactionReceipt): string | undefined {
  if (receipt.mimeType) return receipt.mimeType;
  const ext = receipt.filename?.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext))
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return undefined;
}

function isPDF(mimeType?: string): boolean {
  return mimeType === 'application/pdf';
}

function isImage(mimeType?: string): boolean {
  return !!mimeType?.startsWith('image/');
}

export function EditableReceiptGrid({
  receipts,
  markedForDeletion,
  onToggleDelete,
  editable,
  authHeaders,
  buildUrl,
}: EditableReceiptGridProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();

  if (receipts.length === 0) {
    return (
      <View
        style={[
          styles.emptyState,
          {
            borderColor: colors.border,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(colors.foregroundSecondary, 0.05),
            padding: spacing.lg,
          },
        ]}
      >
        <FileText size={24} color={colors.foregroundSecondary} />
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.foregroundSecondary, marginTop: spacing.sm },
          ]}
        >
          {t('noReceipts')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {receipts.map((receipt) => (
        <GridItem
          key={receipt.id}
          receipt={receipt}
          isMarked={markedForDeletion.has(receipt.id)}
          editable={editable}
          onToggleDelete={onToggleDelete}
          authHeaders={authHeaders}
          buildUrl={buildUrl}
          colors={colors}
          radius={radius}
          spacing={spacing}
          typography={typography}
        />
      ))}
    </View>
  );
}

interface GridItemProps {
  receipt: TransactionReceipt;
  isMarked: boolean;
  editable: boolean;
  onToggleDelete: (id: string) => void;
  authHeaders?: Record<string, string>;
  buildUrl: (receipt: TransactionReceipt) => string;
  colors: any;
  radius: any;
  spacing: any;
  typography: any;
}

function GridItem({
  receipt,
  isMarked,
  editable,
  onToggleDelete,
  authHeaders,
  buildUrl,
  colors,
  radius,
  spacing,
  typography,
}: GridItemProps) {
  const [imageError, setImageError] = React.useState(false);
  const mime = inferMimeType(receipt);
  const pdf = isPDF(mime);
  const image = isImage(mime);
  const fallbackToImage = !pdf && !image;
  const imageUrl = receipt.thumbnailURL || buildUrl(receipt);

  const handlePress = useCallback(() => {
    if (editable) {
      onToggleDelete(receipt.id);
    }
  }, [editable, onToggleDelete, receipt.id]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!editable}
      style={[
        styles.gridItem,
        {
          borderRadius: radius.md,
          borderColor: isMarked ? colors.error : colors.border,
          borderWidth: isMarked ? 2 : 1,
          opacity: isMarked ? 0.5 : 1,
        },
      ]}
      accessibilityLabel={
        editable
          ? `${receipt.filename || 'receipt'} — ${isMarked ? 'marked for removal, tap to undo' : 'tap to mark for removal'}`
          : receipt.filename || 'receipt'
      }
      testID={`editable-receipt-${receipt.id}`}
    >
      {/* Image or PDF placeholder */}
      {(image || fallbackToImage) && !imageError ? (
        <Image
          source={{ uri: imageUrl, headers: authHeaders }}
          style={[styles.image, { borderRadius: radius.md - 1 }]}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={styles.pdfContainer}>
          <FileText
            size={28}
            color={imageError ? colors.foregroundSecondary : '#e53935'}
          />
          {pdf && !imageError && (
            <Text style={[styles.pdfLabel, { color: colors.foregroundSecondary }]}>
              PDF
            </Text>
          )}
        </View>
      )}

      {/* Delete overlay — shown when marked */}
      {isMarked && (
        <View
          style={[
            styles.deleteOverlay,
            { backgroundColor: withAlpha(colors.error, 0.3) },
          ]}
        >
          <View
            style={[
              styles.deleteIcon,
              { backgroundColor: colors.error, borderRadius: radius.full },
            ]}
          >
            <X size={16} color={colors.onError} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31%',
    aspectRatio: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pdfContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pdfLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
