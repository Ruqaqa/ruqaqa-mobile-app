import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { normalizeMediaUrl } from '../../utils/mediaUrl';
import { tokenStorage } from '../../services/tokenStorage';

interface ProfileAvatarProps {
  /** Raw avatar URL — may be relative, absolute, or undefined. */
  url?: string | null;
  /** Employee name — used for initials fallback when no image. */
  name?: string | null;
  /** Diameter in logical pixels. Defaults to 32. */
  size?: number;
}

/**
 * Extract initials from a name: first char of first word + first char of last word.
 * Single word → single char. Empty/whitespace → empty string.
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Circular avatar image with automatic URL normalization, auth header injection,
 * and fallback to a User icon on error or missing URL.
 *
 * Mirrors the Flutter `ProfileAvatar` widget — reusable across AppBar, menus,
 * and any future profile-related surfaces.
 */
export function ProfileAvatar({ url, name, size = 32 }: ProfileAvatarProps) {
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

  const initials = name ? getInitials(name) : '';

  if (initials) {
    const fontSize = Math.round(size * (initials.length === 1 ? 0.44 : 0.38));
    return (
      <View style={[styles.fallback, containerStyle, { backgroundColor: colors.primary }]}>
        <Text style={{ fontSize, fontWeight: '600', color: colors.onPrimary }}>
          {initials}
        </Text>
      </View>
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
