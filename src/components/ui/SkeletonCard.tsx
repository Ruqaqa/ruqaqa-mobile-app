import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { withAlpha } from '../../utils/colorUtils';

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 4 }: SkeletonCardProps) {
  const { colors, radius, spacing } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  const lineWidths = ['75%', '100%', '60%', '85%', '50%'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.sm,
          marginVertical: spacing.xs,
        },
      ]}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.line,
            {
              backgroundColor: withAlpha(colors.foregroundSecondary, 0.15),
              borderRadius: radius.sm,
              width: lineWidths[i % lineWidths.length] as any,
              opacity: shimmerOpacity,
              marginBottom: i < lines - 1 ? spacing.sm : 0,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  line: {
    height: 14,
  },
});
