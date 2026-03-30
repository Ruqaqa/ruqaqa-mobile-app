import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { ReconciliationEmployee, ReconciliationChannel } from '../types';
import { getPartyDisplay, getChannelDisplay } from '../utils/formatters';

interface ReconciliationFlowWidgetProps {
  fromType: string | null;
  fromEmployee: ReconciliationEmployee | null;
  senderChannel: ReconciliationChannel | null;
  toType: string | null;
  toEmployee: ReconciliationEmployee | null;
  receiverChannel: ReconciliationChannel | null;
}

export function ReconciliationFlowWidget({
  fromType,
  fromEmployee,
  senderChannel,
  toType,
  toEmployee,
  receiverChannel,
}: ReconciliationFlowWidgetProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const fromParty = getPartyDisplay(fromType, fromEmployee);
  const toParty = getPartyDisplay(toType, toEmployee);
  const senderChannelName = getChannelDisplay(senderChannel);
  const receiverChannelName = getChannelDisplay(receiverChannel);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.primary, 0.08),
          borderRadius: radius.md,
          padding: spacing.md,
          borderWidth: 2,
          borderColor: colors.primary,
          direction: 'ltr',
        },
      ]}
    >
      {/* From party (left) */}
      <View
        style={[
          styles.partyBox,
          {
            backgroundColor: withAlpha(colors.info, 0.1),
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: withAlpha(colors.info, 0.3),
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.foreground,
              fontWeight: '600',
              textAlign: 'center',
            },
          ]}
          numberOfLines={1}
        >
          {fromParty}
        </Text>
        <Text
          style={[
            typography.labelSmall,
            {
              color: colors.foregroundSecondary,
              textAlign: 'center',
              marginTop: 2,
            },
          ]}
          numberOfLines={1}
        >
          {senderChannelName}
        </Text>
      </View>

      {/* Arrow */}
      <View style={{ paddingHorizontal: spacing.md }}>
        <ArrowRight size={20} color={colors.primary} />
      </View>

      {/* To party (right) */}
      <View
        style={[
          styles.partyBox,
          {
            backgroundColor: withAlpha(colors.success, 0.1),
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: withAlpha(colors.success, 0.3),
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.foreground,
              fontWeight: '600',
              textAlign: 'center',
            },
          ]}
          numberOfLines={1}
        >
          {toParty}
        </Text>
        <Text
          style={[
            typography.labelSmall,
            {
              color: colors.foregroundSecondary,
              textAlign: 'center',
              marginTop: 2,
            },
          ]}
          numberOfLines={1}
        >
          {receiverChannelName}
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
