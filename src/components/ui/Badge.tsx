import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { withAlpha } from '../../utils/colorUtils';

type BadgeVariant = 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'error';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { colors, typography, radius, spacing } = useTheme();

  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    primary: { bg: withAlpha(colors.primary, 0.13), text: colors.primary },
    secondary: { bg: withAlpha(colors.secondary, 0.13), text: colors.secondary },
    muted: { bg: colors.muted, text: colors.foregroundSecondary },
    success: { bg: withAlpha(colors.success, 0.13), text: colors.success },
    warning: { bg: withAlpha(colors.warning, 0.13), text: colors.warning },
    error: { bg: withAlpha(colors.error, 0.13), text: colors.error },
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
