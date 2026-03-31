import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ArrowLeft, ImageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { GalleryAlbum, getLocalizedTitle } from '../types';

interface AlbumDetailScreenProps {
  album: GalleryAlbum;
  onBack: () => void;
}

/**
 * Stub for Phase 5A. Will be replaced with full media browsing in Phase 5B.
 */
export function AlbumDetailScreen({ album, onBack }: AlbumDetailScreenProps) {
  const { colors, typography, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const displayTitle = getLocalizedTitle(album, i18n.language);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text
          style={[typography.headingSmall, { color: colors.foreground, flex: 1 }]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
      </View>

      <EmptyState
        icon={<ImageIcon size={48} color={colors.foregroundSecondary} />}
        title={t('albumsComingSoon')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
});
