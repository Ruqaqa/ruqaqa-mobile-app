import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useTheme } from '../../theme';

interface TotpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

const DIGITS = 6;

export function TotpInput({
  value,
  onChange,
  error,
  autoFocus = true,
}: TotpInputProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const digits = value.padEnd(DIGITS, ' ').split('').slice(0, DIGITS);

  return (
    <View style={styles.container}>
      {/* Visible digit boxes */}
      <View style={styles.boxRow}>
        {digits.map((digit, i) => {
          const isActive = i === value.length;
          const isFilled = digit !== ' ';
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: colors.surface,
                  borderColor: error
                    ? colors.error
                    : isActive
                      ? colors.primary
                      : colors.input,
                  borderWidth: isActive ? 2 : 1,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  styles.digit,
                  {
                    color: colors.foreground,
                    fontSize: typography.headingLarge?.fontSize ?? 24,
                    fontWeight: '700',
                  },
                ]}
              >
                {isFilled ? digit : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Hidden input captures keyboard input */}
      <TextInput
        ref={inputRef}
        testID="totp-input"
        value={value}
        onChangeText={(text) => {
          const clean = text.replace(/[^0-9]/g, '').slice(0, DIGITS);
          onChange(clean);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={DIGITS}
        style={[styles.hiddenInput, { writingDirection: 'ltr' as const }]}
      />

      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[
            typography.bodySmall,
            { color: colors.error, marginTop: spacing.sm, textAlign: 'center' },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  boxRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  box: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
