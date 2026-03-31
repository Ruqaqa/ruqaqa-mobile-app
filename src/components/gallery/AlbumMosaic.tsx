import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { withAlpha } from '../../utils/colorUtils';
import { MediaThumbnail } from './MediaThumbnail';

const GAP = 2;

interface AlbumMosaicProps {
  thumbnails: string[];
  style?: ViewStyle;
}

export function AlbumMosaic({ thumbnails, style }: AlbumMosaicProps) {
  const { colors, radius } = useTheme();
  const count = Math.min(thumbnails.length, 4);

  if (count === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.placeholder,
          {
            backgroundColor: withAlpha(colors.foregroundSecondary, 0.1),
            borderRadius: radius.lg,
          },
          style,
        ]}
      >
        <ImageIcon size={32} color={colors.foregroundSecondary} />
      </View>
    );
  }

  if (count === 1) {
    return (
      <View style={[styles.container, { borderRadius: radius.lg }, style]}>
        <MediaThumbnail uri={thumbnails[0]} style={styles.fill} />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={[styles.container, styles.row, { borderRadius: radius.lg, gap: GAP }, style]}>
        <MediaThumbnail uri={thumbnails[0]} style={styles.fill} />
        <MediaThumbnail uri={thumbnails[1]} style={styles.fill} />
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={[styles.container, styles.row, { borderRadius: radius.lg, gap: GAP }, style]}>
        <MediaThumbnail uri={thumbnails[0]} style={styles.fill} />
        <View style={[styles.fill, { gap: GAP }]}>
          <MediaThumbnail uri={thumbnails[1]} style={styles.fill} />
          <MediaThumbnail uri={thumbnails[2]} style={styles.fill} />
        </View>
      </View>
    );
  }

  // count === 4
  return (
    <View style={[styles.container, { borderRadius: radius.lg, gap: GAP }, style]}>
      <View style={[styles.row, styles.fill, { gap: GAP }]}>
        <MediaThumbnail uri={thumbnails[0]} style={styles.fill} />
        <MediaThumbnail uri={thumbnails[1]} style={styles.fill} />
      </View>
      <View style={[styles.row, styles.fill, { gap: GAP }]}>
        <MediaThumbnail uri={thumbnails[2]} style={styles.fill} />
        <MediaThumbnail uri={thumbnails[3]} style={styles.fill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  fill: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
