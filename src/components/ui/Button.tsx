import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme, Theme } from '../../theme';

type ButtonVariant =
  | 'default'
  | 'gradient'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

function getVariantStyles(
  variant: ButtonVariant,
  theme: Theme,
): { container: ViewStyle; text: TextStyle } {
  const { colors, shadows } = theme;

  switch (variant) {
    case 'gradient':
      return {
        container: {
          backgroundColor: colors.primary,
          ...shadows.gradient,
        },
        text: { color: '#ffffff' },
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.secondary },
        text: { color: '#ffffff' },
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        },
        text: { color: colors.foreground },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: colors.foreground },
      };
    case 'destructive':
      return {
        container: { backgroundColor: colors.error },
        text: { color: '#ffffff' },
      };
    default:
      return {
        container: { backgroundColor: colors.primary },
        text: { color: '#ffffff' },
      };
  }
}

const sizeStyles: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 36, px: 12, fontSize: 13 },
  md: { height: 44, px: 16, fontSize: 14 },
  lg: { height: 48, px: 24, fontSize: 16 },
};

export function Button({
  title,
  onPress,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const { radius } = theme;
  const variantStyle = getVariantStyles(variant, theme);
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.px,
          borderRadius: radius.md,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        variantStyle.container,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color as string} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            { fontSize: sizeStyle.fontSize, fontWeight: '500' },
            variantStyle.text,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
