import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ children, style, elevated = false, ...rest }: CardProps) {
  const { colors, radius, shadows, spacing } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          ...(elevated ? shadows.lg : shadows.md),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});
