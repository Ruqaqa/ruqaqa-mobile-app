import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { AlbumMosaic } from '@/components/gallery/AlbumMosaic';
import { GalleryAlbum, getLocalizedTitle } from '../types';

interface AlbumCardProps {
  album: GalleryAlbum;
  onPress: () => void;
  onLongPress: () => void;
}

export function AlbumCard({ album, onPress, onLongPress }: AlbumCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { t, i18n } = useTranslation();
  const displayTitle = getLocalizedTitle(album, i18n.language);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={displayTitle}
    >
      <View style={styles.mosaic}>
        <AlbumMosaic thumbnails={album.coverThumbnails} />
      </View>

      <View style={[styles.info, { padding: spacing.sm }]}>
        <View style={styles.titleRow}>
          {album.isDefault && (
            <Star
              size={14}
              color={colors.warning}
              fill={colors.warning}
              style={{ marginEnd: spacing.xs }}
            />
          )}
          <Text
            style={[typography.label, { color: colors.foreground, flex: 1 }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        </View>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.foregroundSecondary, marginTop: spacing.xxs },
          ]}
        >
          {album.itemCount} {t('items')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mosaic: {
    aspectRatio: 1,
  },
  info: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
