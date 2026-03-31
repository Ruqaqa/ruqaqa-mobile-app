import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, ViewStyle } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { tokenStorage } from '../../services/tokenStorage';
import { withAlpha } from '../../utils/colorUtils';

interface MediaThumbnailProps {
  uri: string | undefined;
  style?: ViewStyle;
  resizeMode?: 'cover' | 'contain';
}

export function MediaThumbnail({ uri, style, resizeMode = 'cover' }: MediaThumbnailProps) {
  const { colors, radius } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const resolvedUri = useMemo(() => normalizeMediaUrl(uri), [uri]);

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [uri]);

  useEffect(() => {
    tokenStorage.getAccessToken().then(setToken);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    if (loading && resolvedUri && !error) {
      animation.start();
    }
    return () => animation.stop();
  }, [loading, resolvedUri, error, shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  const placeholderBg = withAlpha(colors.foregroundSecondary, 0.15);

  if (!resolvedUri || error) {
    return (
      <View style={[styles.container, { backgroundColor: placeholderBg, borderRadius: radius.md }, style]}>
        <ImageIcon size={24} color={colors.foregroundSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderRadius: radius.md }, style]}>
      {loading && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: placeholderBg, opacity: shimmerOpacity },
          ]}
        />
      )}
      <Image
        source={{
          uri: resolvedUri,
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }}
        style={[StyleSheet.absoluteFill, { resizeMode }]}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
