import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '@/components/ui/StatusChip';
import { withAlpha } from '@/utils/colorUtils';
import { Reconciliation } from '../types';
import { formatDate, formatAmount, getPartyDisplay, getTypeBadgeConfig } from '../utils/formatters';
import { PartyFlowInline } from './PartyFlowInline';

interface ReconciliationCardProps {
  reconciliation: Reconciliation;
  onPress: (reconciliation: Reconciliation) => void;
}

export const ReconciliationCard = React.memo(function ReconciliationCard({
  reconciliation,
  onPress,
}: ReconciliationCardProps) {
  const handlePress = React.useCallback(() => onPress(reconciliation), [onPress, reconciliation]);
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const typeBadge = getTypeBadgeConfig(reconciliation.type);
  const fromDisplay = getPartyDisplay(reconciliation.fromType, reconciliation.fromEmployee);
  const toDisplay = getPartyDisplay(reconciliation.toType, reconciliation.toEmployee);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.sm,
          marginVertical: spacing.xs,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      testID={`reconciliation-card-${reconciliation.id}`}
    >
      {/* Row 1: Statement + Status */}
      <View style={styles.row}>
        <Text
          style={[
            typography.headingSmall,
            { color: colors.foreground, flex: 1 },
          ]}
          numberOfLines={2}
        >
          {reconciliation.statement}
        </Text>
        <StatusChip
          status={
            reconciliation.approvalStatus.toLowerCase() as 'pending' | 'approved' | 'rejected'
          }
        />
      </View>

      {/* Row 2: Amount */}
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Text
          style={[
            typography.headingMedium,
            { color: colors.foreground },
          ]}
        >
          {formatAmount(reconciliation.totalAmount, reconciliation.currency)}
        </Text>
      </View>

      {/* Row 3: Type badge */}
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor: withAlpha(typeBadge.color, 0.12),
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            },
          ]}
        >
          <Text
            style={[
              typography.labelSmall,
              { color: typeBadge.color, fontWeight: '600' },
            ]}
          >
            {t(typeBadge.label as any)}
          </Text>
        </View>
      </View>

      {/* Row 4: From -> To flow line */}
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <PartyFlowInline from={fromDisplay} to={toDisplay} />
      </View>

      {/* Row 5: Footer */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            { color: colors.foregroundSecondary, fontWeight: '700' },
          ]}
        >
          {reconciliation.reconciliationNumber}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
          {formatDate(reconciliation.date ?? reconciliation.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {},
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
});
