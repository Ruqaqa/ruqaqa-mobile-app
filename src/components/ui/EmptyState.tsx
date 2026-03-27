import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors, typography, spacing } = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
        {icon}
      </Animated.View>
      <Text
        style={[
          typography.headingMedium,
          { color: colors.foreground, marginTop: spacing.base, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.foregroundSecondary, marginTop: spacing.xs, textAlign: 'center' },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
