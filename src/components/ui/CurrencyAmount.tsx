import React from 'react';
import { View, Text, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { SaudiRiyalSymbol } from './SaudiRiyalSymbol';
import { formatAmount, isSAR, isUSD } from '@/utils/formatters';

interface CurrencyAmountProps {
  amount: number;
  currency: string; // 'ريال سعودي' or 'دولار أمريكي'
  style?: TextStyle;
  amountColor?: string;
}

export function CurrencyAmount({ amount, currency, style, amountColor }: CurrencyAmountProps) {
  const { colors, typography } = useTheme();
  const color = amountColor ?? colors.foreground;

  const formatted = formatAmount(amount);

  if (isSAR(currency)) {
    return (
      <View style={styles.row}>
        <Text style={[typography.headingSmall, { color }, style]}>
          {formatted}
        </Text>
        <View style={styles.symbolGap}>
          <SaudiRiyalSymbol size={14} color={color} />
        </View>
      </View>
    );
  }

  if (isUSD(currency)) {
    return (
      <View style={styles.row}>
        <Text style={[typography.headingSmall, { color }, style]}>
          $ {formatted}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[typography.headingSmall, { color }, style]}>
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolGap: {
    marginStart: 4,
  },
});
