import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
  Text,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Play, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { normalizeMediaUrl } from '@/utils/mediaUrl';
import { useAuthHeaders } from '@/hooks/useAuthHeaders';
import { MediaItem } from '../types';
import { getFullResMediaUrl } from '../utils/mediaUrls';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoPlayerProps {
  item: MediaItem;
}

/**
 * Video player for the full-screen media viewer.
 * Shows a thumbnail with play overlay initially, then streams the video inline using expo-video.
 * Handles loading, error, and playback states.
 */
export function VideoPlayer({ item }: VideoPlayerProps) {
  const { t } = useTranslation();
  const authHeaders = useAuthHeaders();
  const [playRequested, setPlayRequested] = useState(false);
  const [error, setError] = useState(false);

  const thumbnailUri = useMemo(
    () => normalizeMediaUrl(item.thumbnailUrl),
    [item.thumbnailUrl],
  );

  const videoUri = useMemo(() => getFullResMediaUrl(item.id), [item.id]);

  // Stabilize the source: only rebuild when the URI changes, not on every
  // authHeaders refresh (every 30s). useVideoPlayer recreates the player when
  // its source reference changes, which would interrupt playback.
  const authHeadersRef = useRef(authHeaders);
  authHeadersRef.current = authHeaders;

  const videoSource = useMemo(
    () => videoUri ? { uri: videoUri, headers: authHeadersRef.current } : null,
    [videoUri],
  );

  const player = useVideoPlayer(videoSource, (p) => {
    if (playRequested) {
      p.play();
    }
  });

  // Listen for player errors via statusChange event
  const { status, error: playerError } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined,
  });

  useEffect(() => {
    if (status === 'error' && playRequested) {
      setError(true);
    }
  }, [status, playRequested]);

  const handlePlay = useCallback(() => {
    setPlayRequested(true);
    setError(false);
    player.play();
  }, [player]);

  const handleRetry = useCallback(() => {
    setError(false);
    setPlayRequested(false);
  }, []);

  if (!videoUri || error) {
    return (
      <View style={styles.container}>
        <AlertCircle size={48} color="rgba(255, 255, 255, 0.54)" />
        <Text style={styles.errorText}>{t('failedToPlayVideo')}</Text>
        {error && (
          <Pressable
            onPress={handleRetry}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <RefreshCw size={20} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!playRequested) {
    return (
      <View style={styles.container}>
        {/* Thumbnail background */}
        {thumbnailUri && (
          <Image
            source={{
              uri: thumbnailUri,
              ...(authHeaders ? { headers: authHeaders } : {}),
            }}
            style={styles.thumbnailImage}
            resizeMode="contain"
          />
        )}
        {/* Dark overlay */}
        <View style={styles.thumbnailOverlay} />
        {/* Play button */}
        <Pressable
          onPress={handlePlay}
          style={({ pressed }) => [
            styles.playButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('tapToPlayVideo')}
        >
          <View style={styles.playCircle}>
            <Play size={32} color="#ffffff" fill="#ffffff" />
          </View>
        </Pressable>
      </View>
    );
  }

  // Streaming video player
  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  playButton: {
    zIndex: 1,
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingStart: 4, // Visual centering for play triangle
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  retryButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
