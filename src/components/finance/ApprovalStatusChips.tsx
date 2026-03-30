import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { APPROVAL_STATUSES, ApprovalStatus } from '@/types/shared';

interface ApprovalStatusChipsProps {
  value: ApprovalStatus | null;
  onChange: (value: ApprovalStatus | null) => void;
}

export function ApprovalStatusChips({ value, onChange }: ApprovalStatusChipsProps) {
  const { colors, typography, radius, spacing } = useTheme();

  const chipConfig: Record<ApprovalStatus, { bg: string; activeBg: string; text: string }> = {
    Pending: {
      bg: colors.muted,
      activeBg: colors.pendingBg,
      text: colors.pendingText,
    },
    Approved: {
      bg: colors.muted,
      activeBg: colors.approvedBg,
      text: colors.approvedText,
    },
    Rejected: {
      bg: colors.muted,
      activeBg: colors.rejectedBg,
      text: colors.rejectedText,
    },
  };

  return (
    <View style={styles.container}>
      {APPROVAL_STATUSES.map((status) => {
        const isActive = value === status;
        const config = chipConfig[status];
        return (
          <Pressable
            key={status}
            onPress={() => onChange(isActive ? null : status)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? config.activeBg : config.bg,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            testID={`approval-chip-${status}`}
          >
            <Text
              style={[
                typography.label,
                {
                  color: isActive ? config.text : colors.foregroundSecondary,
                },
              ]}
            >
              {status}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {},
});
