import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

type BadgeVariant = 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'error';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { colors, typography, radius, spacing } = useTheme();

  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    primary: { bg: colors.primary + '20', text: colors.primary },
    secondary: { bg: colors.secondary + '20', text: colors.secondary },
    muted: { bg: colors.muted, text: colors.foregroundSecondary },
    success: { bg: colors.success + '20', text: colors.success },
    warning: { bg: colors.warning + '20', text: colors.warning },
    error: { bg: colors.error + '20', text: colors.error },
  };

  const vc = variantColors[variant];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: vc.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
        },
      ]}
    >
      <Text style={[typography.labelSmall, { color: vc.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
});
