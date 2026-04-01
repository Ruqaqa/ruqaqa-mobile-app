import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  StatusBar,
  Modal,
  ViewToken,
} from 'react-native';
import { X, ImageOff, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthHeaders } from '@/hooks/useAuthHeaders';
import { MediaItem } from '../types';
import { getFullResMediaUrl } from '../utils/mediaUrls';
import { VideoPlayer } from './VideoPlayer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullScreenMediaViewerProps {
  visible: boolean;
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Full-screen media viewer with horizontal swiping between items.
 * Images support pinch-to-zoom via ScrollView. Videos play inline via expo-video.
 * Dark background with media counter and close button.
 */
export function FullScreenMediaViewer({
  visible,
  items,
  initialIndex,
  onClose,
}: FullScreenMediaViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  // When viewer opens, set counter and ensure FlatList scrolls to the correct item.
  // initialScrollIndex alone is unreliable with pagingEnabled + RTL.
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Backup scroll after layout — handles cases where initialScrollIndex doesn't fire
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <View style={styles.pageContainer}>
        {item.mediaType === 'video' ? (
          <VideoPlayer item={item} />
        ) : (
          <ZoomableImage item={item} />
        )}
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.overlay}>
        {/* Header bar */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            hitSlop={12}
          >
            <X size={24} color="#ffffff" />
          </Pressable>

          {items.length > 1 && (
            <Text style={styles.counter} allowFontScaling={false}>
              {`${currentIndex + 1} / ${items.length}`}
            </Text>
          )}
        </View>

        {/* Media pages */}
        <FlatList
          ref={flatListRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
        />
      </View>
    </Modal>
  );
}

/** Zoomable image using ScrollView's built-in zoom support. */
function ZoomableImage({ item }: { item: MediaItem }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const authHeaders = useAuthHeaders();
  const scrollViewRef = useRef<ScrollView>(null);

  const resolvedUri = useMemo(() => getFullResMediaUrl(item.id), [item.id]);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
  }, []);

  // Wait for auth headers before rendering the Image to avoid a 401 race
  if (!resolvedUri || (!authHeaders && !error)) {
    return (
      <View style={styles.centeredContent}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContent}>
        <ImageOff size={64} color="rgba(255, 255, 255, 0.54)" />
        <Pressable
          onPress={handleRetry}
          style={styles.retryButton}
          accessibilityRole="button"
        >
          <RefreshCw size={20} color="rgba(255, 255, 255, 0.7)" />
          <Text style={styles.retryText}>{t('failedToLoadImage')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.zoomContainer}
      contentContainerStyle={styles.zoomContent}
      maximumZoomScale={3}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom
      centerContent
    >
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
      <Image
        source={{
          uri: resolvedUri,
          headers: authHeaders,
        }}
        style={styles.fullImage}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  zoomContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  retryText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
