import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { CurrencyAmount } from '@/components/ui/CurrencyAmount';

interface DetailRowProps {
  label: string;
  value: string | null | undefined;
  valueColor?: string;
  currencyAmount?: { amount: number; currency: string };
  currencySymbol?: React.ReactNode;
}

export function DetailRow({
  label,
  value,
  valueColor,
  currencyAmount,
  currencySymbol,
}: DetailRowProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.md }]}>
      <Text
        style={[
          typography.label,
          styles.label,
          { color: colors.foregroundSecondary },
        ]}
      >
        {label}
      </Text>
      {currencyAmount ? (
        <CurrencyAmount
          amount={currencyAmount.amount}
          currency={currencyAmount.currency}
          amountColor={valueColor}
        />
      ) : (
        <View style={styles.valueContainer}>
          <Text
            style={[
              typography.bodyMedium,
              {
                color: valueColor ?? colors.foreground,
                fontWeight: '600',
              },
            ]}
          >
            {value ?? '\u2014'}
          </Text>
          {currencySymbol && <View style={styles.symbolGap}>{currencySymbol}</View>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    width: 100,
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  symbolGap: {
    marginStart: 4,
  },
});
