import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface StatusChipProps {
  status: ApprovalStatus;
}

/**
 * Colored chip for approval statuses (Pending, Approved, Rejected).
 * Colors match the design system's approval status palette.
 */
export function StatusChip({ status }: StatusChipProps) {
  const { t } = useTranslation();
  const { colors, typography, radius, spacing } = useTheme();

  const config: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
    pending: {
      bg: colors.pendingBg,
      text: colors.pendingText,
      label: t('pendingStatus'),
    },
    approved: {
      bg: colors.approvedBg,
      text: colors.approvedText,
      label: t('approved'),
    },
    rejected: {
      bg: colors.rejectedBg,
      text: colors.rejectedText,
      label: t('rejectedStatus'),
    },
  };

  const c = config[status];

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: c.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
        },
      ]}
    >
      <Text style={[typography.labelSmall, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
});
