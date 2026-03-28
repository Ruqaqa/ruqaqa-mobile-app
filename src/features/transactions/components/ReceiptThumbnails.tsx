import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { FileText, Download } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { tokenStorage } from '@/services/tokenStorage';
import { config } from '@/services/config';
import { TransactionReceipt } from '../types';
import { ReceiptViewer } from './ReceiptViewer';

interface ReceiptThumbnailsProps {
  receipts: TransactionReceipt[];
}

/** Infer mimeType from receipt data — check mimeType field, then fall back to filename extension */
function inferMimeType(receipt: TransactionReceipt): string | undefined {
  if (receipt.mimeType) return receipt.mimeType;
  const ext = receipt.filename?.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return undefined;
}

/** Check if mimeType is an image */
function isImage(mimeType?: string): boolean {
  return !!mimeType?.startsWith('image/');
}

/** Check if mimeType is a PDF */
function isPDF(mimeType?: string): boolean {
  return mimeType === 'application/pdf';
}

/** Build full receipt URL via the mobile receipts API endpoint */
function buildReceiptUrl(receipt: TransactionReceipt): string {
  return `${config.apiBaseUrl}/api/mobile/receipts/file/${receipt.id}`;
}

/** Build receipt URL with token in query for external viewers (PDF, browser) */
function buildExternalUrl(receipt: TransactionReceipt, token: string | null): string {
  const base = buildReceiptUrl(receipt);
  if (!token) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function ReceiptThumbnails({ receipts }: ReceiptThumbnailsProps) {
  const { colors, radius, spacing } = useTheme();
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [viewerReceipt, setViewerReceipt] = useState<TransactionReceipt | null>(null);

  useEffect(() => {
    tokenStorage.getAccessToken().then(setToken);
  }, []);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const handleTap = useCallback(
    (receipt: TransactionReceipt) => {
      const mime = inferMimeType(receipt);
      if (isPDF(mime)) {
        const url = buildExternalUrl(receipt, token);
        WebBrowser.openBrowserAsync(url).catch(() => {
          Alert.alert(t('error'), t('receiptOpenFailed'));
        });
      } else {
        // Image or unknown — open in viewer
        setViewerReceipt(receipt);
      }
    },
    [token, t],
  );

  const handleCloseViewer = useCallback(() => {
    setViewerReceipt(null);
  }, []);

  if (receipts.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {receipts.map((receipt) => (
          <ThumbnailItem
            key={receipt.id}
            receipt={receipt}
            token={token}
            authHeaders={authHeaders}
            onTap={handleTap}
            colors={colors}
            radius={radius}
            spacing={spacing}
            t={t}
          />
        ))}
      </ScrollView>

      {/* Full-screen image viewer */}
      {viewerReceipt && (
        <ReceiptViewer
          visible
          imageUri={buildReceiptUrl(viewerReceipt)}
          headers={authHeaders}
          onClose={handleCloseViewer}
        />
      )}
    </>
  );
}

// --- Thumbnail item ---

interface ThumbnailItemProps {
  receipt: TransactionReceipt;
  token: string | null;
  authHeaders?: Record<string, string>;
  onTap: (receipt: TransactionReceipt) => void;
  colors: any;
  radius: any;
  spacing: any;
  t: (key: string) => string;
}

function ThumbnailItem({
  receipt,
  token,
  authHeaders,
  onTap,
  colors,
  radius,
  spacing,
  t,
}: ThumbnailItemProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(
    async (e: any) => {
      // Prevent triggering the parent tap
      e?.stopPropagation?.();
      if (downloading) return;

      setDownloading(true);
      try {
        const url = buildReceiptUrl(receipt);
        const filename = receipt.filename || `receipt_${receipt.id}`;
        const fileUri = FileSystem.cacheDirectory + filename;

        const downloaded = await FileSystem.downloadAsync(url, fileUri, {
          headers: authHeaders ?? {},
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri, {
            mimeType: receipt.mimeType || inferMimeType(receipt),
            dialogTitle: t('receiptDownload'),
          });
        } else {
          Alert.alert(t('error'), t('receiptSharingUnavailable'));
        }
      } catch {
        Alert.alert(t('error'), t('receiptDownloadFailed'));
      } finally {
        setDownloading(false);
      }
    },
    [receipt, token, authHeaders, downloading, t],
  );

  const mime = inferMimeType(receipt);
  const pdf = isPDF(mime);
  const image = isImage(mime);
  // If no mimeType at all, still try loading via API URL (server sets Content-Type)
  const fallbackToImage = !pdf && !image;
  const imageUrl = receipt.thumbnailURL || buildReceiptUrl(receipt);
  const [imageError, setImageError] = useState(false);

  return (
    <Pressable
      onPress={() => onTap(receipt)}
      style={[
        styles.thumbnail,
        {
          backgroundColor: colors.muted,
          borderRadius: radius.md,
          borderColor: colors.border,
        },
      ]}
    >
      {(image || fallbackToImage) && !imageError ? (
        <Image
          source={{
            uri: imageUrl,
            headers: authHeaders,
          }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : pdf || imageError ? (
        <View style={styles.pdfContainer}>
          <FileText size={28} color={imageError ? colors.foregroundSecondary : '#e53935'} />
          {!imageError && (
            <Text style={[styles.pdfLabel, { color: colors.foregroundSecondary }]}>
              PDF
            </Text>
          )}
        </View>
      ) : (
        <FileText size={24} color={colors.foregroundSecondary} />
      )}

      {/* Download button overlay */}
      <Pressable
        onPress={handleDownload}
        hitSlop={6}
        style={[
          styles.downloadButton,
          { backgroundColor: withAlpha(colors.background, 0.9) },
        ]}
      >
        {downloading ? (
          <ActivityIndicator size={14} color={colors.primary} />
        ) : (
          <Download size={14} color={colors.primary} />
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 72,
    height: 72,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 72,
    height: 72,
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
  downloadButton: {
    position: 'absolute',
    bottom: 4,
    start: 4,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
