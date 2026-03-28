import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

interface TransactionFlowWidgetProps {
  partnerLabel: string | null;
  otherPartyLabel: string | null;
  /** true when money flows out (expense: partner → other party) */
  isExpense: boolean;
}

export function TransactionFlowWidget({
  partnerLabel,
  otherPartyLabel,
  isExpense,
}: TransactionFlowWidgetProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const isEmpty = !partnerLabel || !otherPartyLabel;

  // Other Party on left, Partner on right.
  // Expense = arrow left (partner → other party), Revenue = arrow right (other party → partner).
  const ArrowIcon = isExpense ? ArrowLeft : ArrowRight;

  const arrowColor = isEmpty ? colors.foregroundSecondary : colors.primary;
  const partnerBg = isEmpty ? colors.muted : withAlpha(colors.info, 0.1);
  const partnerBorder = isEmpty ? colors.border : withAlpha(colors.info, 0.3);
  const otherPartyBg = isEmpty ? colors.muted : withAlpha(colors.success, 0.1);
  const otherPartyBorder = isEmpty ? colors.border : withAlpha(colors.success, 0.3);
  const textColor = isEmpty ? colors.foregroundSecondary : colors.foreground;
  const outerBorder = isEmpty ? colors.border : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isEmpty ? colors.muted : withAlpha(colors.primary, 0.08),
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: isEmpty ? 1 : 2,
          borderColor: outerBorder,
          direction: 'ltr',
        },
      ]}
    >
      {/* Other Party (always on left) */}
      <View
        style={[
          styles.partyBox,
          {
            backgroundColor: otherPartyBg,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: otherPartyBorder,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            {
              color: textColor,
              fontWeight: '600',
              fontStyle: isEmpty ? 'italic' : 'normal',
              textAlign: 'center',
            },
          ]}
          numberOfLines={1}
        >
          {otherPartyLabel ?? '—'}
        </Text>
      </View>

      {/* Arrow */}
      <View style={{ paddingHorizontal: spacing.md }}>
        <ArrowIcon size={20} color={arrowColor} />
      </View>

      {/* Partner (always on right) */}
      <View
        style={[
          styles.partyBox,
          {
            backgroundColor: partnerBg,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: partnerBorder,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            {
              color: textColor,
              fontWeight: '600',
              fontStyle: isEmpty ? 'italic' : 'normal',
              textAlign: 'center',
            },
          ]}
          numberOfLines={1}
        >
          {partnerLabel ?? '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyBox: {
    flex: 2,
  },
});
