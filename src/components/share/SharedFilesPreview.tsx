import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { FileText, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

export interface SharedFile {
  uri: string;
  mimeType: string;
  fileName: string;
}

interface SharedFilesPreviewProps {
  files: SharedFile[];
  onRemove?: (index: number) => void;
  /** Max visible thumbnails before showing "+N more" */
  maxVisible?: number;
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function SharedFilesPreview({
  files,
  onRemove,
  maxVisible = 5,
}: SharedFilesPreviewProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();

  if (files.length === 0) return null;

  const visibleFiles = files.slice(0, maxVisible);
  const overflowCount = files.length - maxVisible;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { gap: spacing.sm, paddingHorizontal: spacing.xxs },
      ]}
    >
      {visibleFiles.map((file, index) => (
        <View
          key={`${file.uri}-${index}`}
          style={[
            styles.thumbnailWrapper,
            {
              backgroundColor: colors.muted,
              borderRadius: radius.md,
              borderColor: colors.border,
            },
          ]}
        >
          {isImageMime(file.mimeType) ? (
            <Image
              source={{ uri: file.uri }}
              style={[styles.thumbnailImage, { borderRadius: radius.md }]}
              accessibilityLabel={file.fileName}
            />
          ) : (
            <View style={styles.docPreview}>
              <FileText size={24} color={colors.foregroundSecondary} />
              <Text
                style={[
                  typography.bodySmall,
                  {
                    color: colors.foregroundSecondary,
                    marginTop: spacing.xxs,
                    textAlign: 'center',
                  },
                ]}
                numberOfLines={1}
              >
                {file.fileName}
              </Text>
            </View>
          )}
          {onRemove && (
            <Pressable
              onPress={() => onRemove(index)}
              hitSlop={6}
              style={[
                styles.removeButton,
                {
                  backgroundColor: colors.error,
                  borderRadius: radius.full,
                },
              ]}
              accessibilityLabel={`${t('removeAttachment')} ${file.fileName}`}
              testID={`shared-file-remove-${index}`}
            >
              <X size={10} color={colors.onError} />
            </Pressable>
          )}
        </View>
      ))}
      {overflowCount > 0 && (
        <View
          style={[
            styles.overflowBadge,
            {
              backgroundColor: withAlpha(colors.primary, 0.1),
              borderRadius: radius.md,
            },
          ]}
        >
          <Text
            style={[
              typography.label,
              { color: colors.primary },
            ]}
          >
            +{overflowCount}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  docPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  removeButton: {
    position: 'absolute',
    top: 3,
    end: 3,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBadge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
