import React, { forwardRef } from 'react';
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
  ({ label, error, style, ...rest }, ref) => {
    const { colors, typography, spacing, radius } = useTheme();
    const hasError = !!error;

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
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: hasError ? colors.error : colors.input,
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
    borderWidth: 1,
  },
});
