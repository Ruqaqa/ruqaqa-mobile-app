import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { tokenStorage } from '../../services/tokenStorage';

interface ProfileAvatarProps {
  /** Raw avatar URL — may be relative, absolute, or undefined. */
  url?: string | null;
  /** Diameter in logical pixels. Defaults to 32. */
  size?: number;
}

/**
 * Circular avatar image with automatic URL normalization, auth header injection,
 * and fallback to a User icon on error or missing URL.
 *
 * Mirrors the Flutter `ProfileAvatar` widget — reusable across AppBar, menus,
 * and any future profile-related surfaces.
 */
export function ProfileAvatar({ url, size = 32 }: ProfileAvatarProps) {
  const { colors, radius } = useTheme();
  const [imgError, setImgError] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const resolvedUri = useMemo(() => normalizeMediaUrl(url), [url]);

  // Reset error state when URL changes
  useEffect(() => {
    setImgError(false);
  }, [url]);

  // Fetch auth token for protected media endpoints
  useEffect(() => {
    tokenStorage.getAccessToken().then(setToken);
  }, []);

  const showImage = resolvedUri && !imgError;
  const iconSize = Math.round(size * 0.56);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius.full,
  };

  if (showImage) {
    return (
      <Image
        source={{
          uri: resolvedUri,
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }}
        style={[styles.image, containerStyle]}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={[styles.fallback, containerStyle, { backgroundColor: colors.muted }]}>
      <User size={iconSize} color={colors.foregroundSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    // borderRadius applied via containerStyle
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
