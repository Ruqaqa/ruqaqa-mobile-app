import React, { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, style, onFocus, onBlur, ...rest }, ref) => {
    const { colors, typography, spacing, radius } = useTheme();
    const hasError = !!error;
    const [isFocused, setIsFocused] = useState(false);

    const borderColor = hasError
      ? colors.error
      : isFocused
        ? colors.primary
        : colors.input;
    const borderWidth = isFocused ? 2 : 1;

    return (
      <View style={styles.wrapper}>
        {label && (
          <Text style={[typography.label, { color: colors.foreground, marginBottom: spacing.xs }]}>
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.foregroundSecondary}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor,
              borderWidth,
              borderRadius: radius.md,
              color: colors.foreground,
              fontSize: typography.bodyMedium.fontSize,
              paddingHorizontal: spacing.md,
            },
            style,
          ]}
          {...rest}
        />
        {hasError && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.xxs }]}>
            {error}
          </Text>
        )}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  input: {
    height: 44,
  },
});
