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
 * Extract the raw Bearer token from auth headers.
 * Returns null if no token is available.
 */
function extractToken(headers: { Authorization: string } | undefined): string | null {
  if (!headers?.Authorization) return null;
  const parts = headers.Authorization.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Video player for the full-screen media viewer.
 * Shows a thumbnail with play overlay initially, then streams the video inline using expo-video.
 * Handles loading, error, and playback states.
 *
 * Auth strategy: Native video players (ExoPlayer/AVPlayer) don't reliably forward
 * custom HTTP headers. We use belt-and-suspenders: both a `?token=xxx` query param
 * in the URL (which the server accepts) AND `headers: { Authorization }` on the
 * video source object. The useMemo depends on a boolean `hasToken` (not the token
 * string) to avoid recreating the player on every 30s token refresh.
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

  const baseVideoUri = useMemo(() => getFullResMediaUrl(item.id), [item.id]);

  // Keep a stable ref to the latest token so the source memo doesn't depend
  // on the token string itself (which changes every 30s).
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = extractToken(authHeaders);
  const hasToken = tokenRef.current != null;

  // Build the video source with ?token=xxx in the URL for native player auth,
  // plus headers as a secondary auth mechanism.
  // The dependency on `hasToken` (boolean) ensures the player is only recreated
  // when auth availability changes (logged in/out), not on every 30s refresh.
  const videoSource = useMemo(() => {
    if (!baseVideoUri) return null;
    const token = tokenRef.current;
    const uri = token
      ? `${baseVideoUri}?token=${encodeURIComponent(token)}`
      : baseVideoUri;
    return {
      uri,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseVideoUri, hasToken]);

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

  if (!baseVideoUri || error) {
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
