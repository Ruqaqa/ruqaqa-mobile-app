import React from 'react';
import {
  View,
  ScrollView,
  Image,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { EyeOff } from 'lucide-react-native';
import { WatermarkDraft } from '../types';
import type { EditorMediaItem } from '../hooks/useWatermarkEditor';

const THUMBNAIL_SIZE = 64;
const ACTIVE_BORDER_WIDTH = 2.5;
const ACTIVE_SCALE = 1.1;

interface WatermarkThumbnailStripProps {
  items: EditorMediaItem[];
  activeIndex: number;
  onItemSelected: (index: number) => void;
  drafts: Record<string, WatermarkDraft>;
}

export function WatermarkThumbnailStrip({
  items,
  activeIndex,
  onItemSelected,
  drafts,
}: WatermarkThumbnailStripProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const disabled = drafts[item.id]?.noWatermarkNeeded ?? false;

          return (
            <Pressable
              key={item.id}
              onPress={() => onItemSelected(index)}
              testID={`thumbnail_${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Item ${index + 1}`}
              accessibilityState={{ selected: isActive }}
            >
              <View
                style={[
                  styles.thumbnailOuter,
                  isActive && {
                    transform: [{ scale: ACTIVE_SCALE }],
                  },
                ]}
              >
                {/* Active border ring */}
                {isActive && <View style={styles.activeBorder} />}

                {/* Thumbnail image */}
                <View
                  style={[
                    styles.thumbnailInner,
                    {
                      margin: isActive ? ACTIVE_BORDER_WIDTH : 0,
                      borderRadius: isActive ? 5.5 : 8,
                    },
                    !isActive && styles.inactiveBorder,
                  ]}
                >
                  <Image
                    source={{ uri: item.thumbnailUri || item.uri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Disabled overlay */}
                {disabled && (
                  <View style={styles.disabledOverlay}>
                    <EyeOff size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                )}

                {/* Index badge */}
                <View style={styles.indexBadge}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    backgroundColor: '#1e293b',
    paddingBottom: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbnailOuter: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  activeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: ACTIVE_BORDER_WIDTH,
    borderColor: '#1428a0',
    borderRadius: 8,
  },
  thumbnailInner: {
    flex: 1,
    overflow: 'hidden',
  },
  inactiveBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadge: {
    position: 'absolute',
    top: 2,
    start: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.54)',
    borderRadius: 4,
  },
  indexText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
});
