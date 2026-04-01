import React, { useCallback, useRef, useEffect } from 'react';
import { Pressable, View, StyleSheet, Animated } from 'react-native';
import { Video as VideoIcon, Check } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { MediaThumbnail } from '@/components/gallery/MediaThumbnail';
import { withAlpha } from '@/utils/colorUtils';
import { MediaItem } from '../types';

interface MediaGridItemProps {
  item: MediaItem;
  onPress: () => void;
  /** Whether multi-select mode is active */
  isSelectionMode?: boolean;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Called when the user long-presses to enter selection mode */
  onLongPress?: () => void;
  /** Called when the user taps to toggle selection (only in selection mode) */
  onSelect?: () => void;
}

/**
 * A single media item in the album grid.
 * Displays the thumbnail with a video indicator overlay for video items.
 * Supports multi-select mode with checkbox overlay (Phase 5C).
 */
export function MediaGridItem({
  item,
  onPress,
  isSelectionMode = false,
  isSelected = false,
  onLongPress,
  onSelect,
}: MediaGridItemProps) {
  const { colors, radius, spacing } = useTheme();

  // Animate checkbox appearance when entering/exiting selection mode
  const checkboxOpacity = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(checkboxOpacity, {
      toValue: isSelectionMode ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isSelectionMode, checkboxOpacity]);

  useEffect(() => {
    if (isSelected) {
      Animated.spring(checkmarkScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 12,
      }).start();
    } else {
      Animated.timing(checkmarkScale, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected, checkmarkScale]);

  const handlePress = useCallback(() => {
    if (isSelectionMode && onSelect) {
      onSelect();
    } else {
      onPress();
    }
  }, [isSelectionMode, onSelect, onPress]);

  const handleLongPress = useCallback(() => {
    if (!isSelectionMode && onLongPress) {
      onLongPress();
    }
  }, [isSelectionMode, onLongPress]);

  const itemLabel = item.filename ?? (item.mediaType === 'video' ? 'Video' : 'Image');

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.container,
        {
          borderRadius: radius.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole={isSelectionMode ? 'checkbox' : 'button'}
      accessibilityState={isSelectionMode ? { checked: isSelected } : undefined}
      accessibilityLabel={itemLabel}
    >
      <MediaThumbnail
        uri={item.thumbnailUrl ?? undefined}
        style={{ ...styles.thumbnail, borderRadius: radius.sm }}
      />

      {/* Selection overlay — green tint + border when selected */}
      {isSelectionMode && isSelected && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: withAlpha(colors.green, 0.3),
              borderRadius: radius.sm,
              borderWidth: 3,
              borderColor: colors.green,
            },
          ]}
        />
      )}

      {/* Checkbox circle overlay — visible in selection mode */}
      {isSelectionMode && (
        <Animated.View
          style={[
            styles.checkbox,
            {
              top: spacing.sm,
              end: spacing.sm,
              opacity: checkboxOpacity,
              backgroundColor: isSelected ? colors.green : 'rgba(0, 0, 0, 0.3)',
              borderColor: isSelected ? colors.green : '#ffffff',
            },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Animated.View style={{ transform: [{ scale: checkmarkScale }] }}>
            <Check size={14} color="#ffffff" />
          </Animated.View>
        </Animated.View>
      )}

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
  checkbox: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
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
