import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  ImageIcon,
  Video,
  X,
  Trash2,
} from 'lucide-react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { Button } from '@/components/ui/Button';
import {
  GalleryAlbum,
  PickerItem,
  MAX_IMAGES,
} from '../types';
import { MetadataPickerField } from './MetadataPickerField';

interface UploadScreenProps {
  images: ImagePickerAsset[];
  video: ImagePickerAsset | null;
  isLoadingVideo: boolean;
  selectedAlbums: GalleryAlbum[];
  selectedTags: PickerItem[];
  selectedProject: PickerItem | null;
  isLocked: boolean;
  canUpload: boolean;
  onPickImages: () => void;
  onPickVideo: () => void;
  onRemoveImage: (index: number) => void;
  onRemoveVideo: () => void;
  onRemoveAllImages: () => void;
  onOpenAlbumPicker: () => void;
  onOpenTagPicker: () => void;
  onOpenProjectPicker: () => void;
  onAlbumsChange: (albums: GalleryAlbum[]) => void;
  onTagsChange: (tags: PickerItem[]) => void;
  onProjectChange: (project: PickerItem | null) => void;
  onUpload: () => void;
  /** Override the upload button label (e.g. "New Upload" after completion). */
  uploadButtonTitle?: string;
  /** Show the upload/reset button even when the form is locked (for done/error states). */
  showButtonWhenLocked?: boolean;
  pipelineContent?: React.ReactNode;
}

const IMAGE_GRID_COLUMNS = 3;
const GRID_GAP = 8;

function getImageItemSize(): number {
  const screenWidth = Dimensions.get('window').width;
  const contentPadding = 16 * 2; // spacing.base on each side
  const totalGap = GRID_GAP * (IMAGE_GRID_COLUMNS - 1);
  return Math.floor((screenWidth - contentPadding - totalGap) / IMAGE_GRID_COLUMNS);
}

/**
 * Upload screen: media picker cards, preview grid, metadata selectors, and upload button.
 * Pure UI component -- state is managed by the parent (useUploadForm hook).
 */
export function UploadScreen({
  images,
  video,
  isLoadingVideo,
  selectedAlbums,
  selectedTags,
  selectedProject,
  isLocked,
  canUpload,
  onPickImages,
  onPickVideo,
  onRemoveImage,
  onRemoveVideo,
  onRemoveAllImages,
  onOpenAlbumPicker,
  onOpenTagPicker,
  onOpenProjectPicker,
  onAlbumsChange,
  onTagsChange,
  onProjectChange,
  onUpload,
  uploadButtonTitle,
  showButtonWhenLocked,
  pipelineContent,
}: UploadScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const scrollRef = useRef<ScrollView>(null);

  const hasMedia = images.length > 0 || video !== null;
  const showPreview = hasMedia || isLoadingVideo;
  const lockedOpacity = isLocked ? 0.5 : 1;
  const itemSize = getImageItemSize();

  // Auto-scroll to bottom when pipeline content appears or updates
  useEffect(() => {
    if (pipelineContent && isLocked) {
      // Small delay to let layout settle after new content renders
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pipelineContent, isLocked]);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.base, paddingBottom: spacing.xxxl }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Media Picker Cards */}
      <View
        style={[styles.pickerRow, { gap: spacing.md, opacity: lockedOpacity }]}
        pointerEvents={isLocked ? 'none' : 'auto'}
      >
        <Pressable
          onPress={onPickImages}
          disabled={isLocked}
          style={({ pressed }) => [
            styles.pickerCard,
            {
              borderColor: colors.border,
              borderRadius: radius.lg,
              backgroundColor: pressed ? withAlpha(colors.primary, 0.05) : colors.surface,
              paddingVertical: spacing.lg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          accessibilityLabel={t('galleryUploadPickImage')}
          accessibilityRole="button"
        >
          <ImageIcon size={32} color={colors.primary} />
          <Text
            style={[
              typography.label,
              { color: colors.foreground, marginTop: spacing.sm, textAlign: 'center' },
            ]}
          >
            {t('galleryUploadPickImage')}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.foregroundSecondary, marginTop: spacing.xs, textAlign: 'center' },
            ]}
          >
            {t('galleryMaxImagesHint', { max: MAX_IMAGES })}
          </Text>
        </Pressable>

        <Pressable
          onPress={onPickVideo}
          disabled={isLocked}
          style={({ pressed }) => [
            styles.pickerCard,
            {
              borderColor: colors.border,
              borderRadius: radius.lg,
              backgroundColor: pressed ? withAlpha(colors.primary, 0.05) : colors.surface,
              paddingVertical: spacing.lg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          accessibilityLabel={t('galleryUploadPickVideo')}
          accessibilityRole="button"
        >
          <Video size={32} color={colors.primary} />
          <Text
            style={[
              typography.label,
              { color: colors.foreground, marginTop: spacing.sm, textAlign: 'center' },
            ]}
          >
            {t('galleryUploadPickVideo')}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.foregroundSecondary, marginTop: spacing.xs, textAlign: 'center' },
            ]}
          >
            {t('galleryOneVideoHint')}
          </Text>
        </Pressable>
      </View>

      {/* Media Preview */}
      {showPreview && (
        <View style={{ marginTop: spacing.base, opacity: lockedOpacity }}>
          {/* Video preview */}
          {(video || isLoadingVideo) && (
            <View
              style={[
                styles.videoCard,
                {
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: video ? colors.surface : withAlpha(colors.secondary, 0.08),
                  overflow: 'hidden',
                },
              ]}
            >
              {video ? (
                <>
                  <Image
                    source={{ uri: video.uri }}
                    style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
                    resizeMode="cover"
                  />
                  <View style={styles.videoOverlay}>
                    <Video size={36} color="#ffffff" />
                  </View>
                  {!isLocked && (
                    <Pressable
                      onPress={onRemoveVideo}
                      style={[
                        styles.removeButton,
                        {
                          backgroundColor: withAlpha(colors.error, 0.85),
                          borderRadius: radius.full,
                        },
                      ]}
                      accessibilityLabel={t('galleryUploadRemoveFile')}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <X size={14} color="#ffffff" />
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={colors.secondary} />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.secondary, marginTop: spacing.sm },
                    ]}
                  >
                    {t('loadingMedia')}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Image preview grid */}
          {images.length > 0 && (
            <View style={{ marginTop: video || isLoadingVideo ? spacing.md : 0 }}>
              {images.length > 1 && !isLocked && (
                <Pressable
                  onPress={onRemoveAllImages}
                  style={[styles.removeAllRow, { marginBottom: spacing.sm }]}
                  accessibilityLabel={t('galleryUploadRemoveAll')}
                  accessibilityRole="button"
                >
                  <Trash2 size={14} color={colors.error} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.error, marginStart: spacing.xs },
                    ]}
                  >
                    {t('galleryUploadRemoveAll')}
                  </Text>
                </Pressable>
              )}
              <View style={[styles.imageGrid, { gap: GRID_GAP }]}>
                {images.map((img, index) => (
                  <View
                    key={`${img.uri}-${index}`}
                    style={[
                      {
                        width: itemSize,
                        height: itemSize,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(colors.foregroundSecondary, 0.1),
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: img.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    {!isLocked && (
                      <Pressable
                        onPress={() => onRemoveImage(index)}
                        style={[
                          styles.imageRemoveButton,
                          {
                            backgroundColor: withAlpha(colors.error, 0.85),
                            borderRadius: radius.full,
                          },
                        ]}
                        accessibilityLabel={t('galleryUploadRemoveFile')}
                        accessibilityRole="button"
                        hitSlop={4}
                      >
                        <X size={12} color="#ffffff" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Metadata Section */}
      {hasMedia && (
        <View
          style={{ marginTop: spacing.base, opacity: lockedOpacity }}
          pointerEvents={isLocked ? 'none' : 'auto'}
        >
          <MetadataPickerField
            label={t('galleryAlbums')}
            hint={t('gallerySelectAlbumsHint')}
            iconName="album"
            selectedItems={selectedAlbums}
            displayString={(a) => a.title}
            itemId={(a) => a.id}
            onPress={onOpenAlbumPicker}
            onRemove={(album) => {
              onAlbumsChange(selectedAlbums.filter((a) => a.id !== album.id));
            }}
            isRequired
          />
          <MetadataPickerField
            label={t('galleryTags')}
            hint={t('gallerySelectTagsHint')}
            iconName="tag"
            selectedItems={selectedTags}
            displayString={(item) => item.name}
            itemId={(item) => item.id}
            onPress={onOpenTagPicker}
            onRemove={(tag) => {
              onTagsChange(selectedTags.filter((item) => item.id !== tag.id));
            }}
            isRequired
          />
          <MetadataPickerField
            label={t('project')}
            hint={t('gallerySelectProjectHint')}
            iconName="folder"
            selectedItems={selectedProject ? [selectedProject] : []}
            displayString={(p) => p.name}
            itemId={(p) => p.id}
            onPress={onOpenProjectPicker}
            onRemove={() => onProjectChange(null)}
          />
        </View>
      )}

      {/* Pipeline progress (injected from parent) */}
      {pipelineContent}

      {/* Upload / Reset Button */}
      {(!isLocked || showButtonWhenLocked) && (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            title={uploadButtonTitle ?? t('upload')}
            onPress={onUpload}
            variant={showButtonWhenLocked && isLocked ? 'outline' : 'default'}
            size="lg"
            disabled={!showButtonWhenLocked && !canUpload}
            testID="upload-button"
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerRow: {
    flexDirection: 'row',
  },
  pickerCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  videoCard: {
    height: 160,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    end: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    end: 4,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
});
