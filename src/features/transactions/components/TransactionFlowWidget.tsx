import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

interface TransactionFlowWidgetProps {
  partnerLabel: string | null;
  otherPartyLabel: string | null;
}

export function TransactionFlowWidget({
  partnerLabel,
  otherPartyLabel,
}: TransactionFlowWidgetProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const isMuted = !partnerLabel || !otherPartyLabel;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.primary, 0.08),
          borderRadius: radius.lg,
          padding: spacing.md,
          opacity: isMuted ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.party}>
        <Text
          style={[typography.labelSmall, { color: colors.foregroundSecondary }]}
        >
          Partner
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.foreground, fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {partnerLabel ?? '—'}
        </Text>
      </View>
      <ArrowRight size={20} color={colors.primary} />
      <View style={styles.party}>
        <Text
          style={[typography.labelSmall, { color: colors.foregroundSecondary }]}
        >
          Other Party
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.foreground, fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {otherPartyLabel ?? '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  party: {
    flex: 1,
  },
});
