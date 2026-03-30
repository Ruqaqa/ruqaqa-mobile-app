import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Input } from '@/components/ui/Input';
import { withAlpha } from '@/utils/colorUtils';

interface AmountInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  isNegative: boolean;
  onToggleSign: () => void;
  placeholder?: string;
}

export function AmountInput({
  label,
  value,
  onChangeText,
  isNegative,
  onToggleSign,
  placeholder,
}: AmountInputProps) {
  const { colors, typography, radius } = useTheme();
  const displayValue = value.replace(/^-/, '');

  return (
    <View>
      <Input
        label={label}
        value={displayValue}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType="decimal-pad"
        style={{ paddingEnd: 40 }}
      />
      <Pressable
        onPress={onToggleSign}
        hitSlop={6}
        style={[
          styles.signToggle,
          {
            backgroundColor: isNegative
              ? withAlpha(colors.error, 0.15)
              : withAlpha(colors.green, 0.15),
            borderRadius: radius.full,
          },
        ]}
      >
        <Text
          style={[
            typography.label,
            {
              color: isNegative ? colors.error : colors.green,
              fontWeight: '700',
            },
          ]}
        >
          {isNegative ? '\u2212' : '+'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  signToggle: {
    position: 'absolute',
    end: 8,
    bottom: 24,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
