import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Video as VideoIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { MediaThumbnail } from '@/components/gallery/MediaThumbnail';
import { withAlpha } from '@/utils/colorUtils';
import { MediaItem } from '../types';

interface MediaGridItemProps {
  item: MediaItem;
  onPress: () => void;
}

/**
 * A single media item in the album grid.
 * Displays the thumbnail with a video indicator overlay for video items.
 * Designed to be selection-ready for Phase 5C (long-press selection mode).
 */
export function MediaGridItem({ item, onPress }: MediaGridItemProps) {
  const { radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderRadius: radius.sm, opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        item.filename ?? (item.mediaType === 'video' ? 'Video' : 'Image')
      }
    >
      <MediaThumbnail
        uri={item.thumbnailUrl ?? undefined}
        style={{ ...styles.thumbnail, borderRadius: radius.sm }}
      />

      {item.mediaType === 'video' && (
        <View style={[styles.videoIndicator, { borderRadius: radius.sm }]}>
          <VideoIcon size={16} color="#ffffff" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 1,
    overflow: 'hidden',
  },
  thumbnail: {
    flex: 1,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    end: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
