import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/theme';

interface PartyFlowInlineProps {
  from: string;
  to: string;
  textStyle?: TextStyle;
  style?: ViewStyle;
  iconSize?: number;
  iconColor?: string;
}

// LTR-forced inline party flow: [to] ← [from]. Mirrors ReconciliationFlowWidget's
// direction convention so the arrow always points at the receiver regardless of locale —
// Unicode arrow glyphs do not honor `direction`, so a real icon inside an ltr container is required.
export function PartyFlowInline({
  from,
  to,
  textStyle,
  style,
  iconSize = 14,
  iconColor,
}: PartyFlowInlineProps) {
  const { colors, typography, spacing } = useTheme();
  const resolvedIconColor = iconColor ?? colors.foregroundSecondary;
  const resolvedTextStyle: TextStyle = {
    color: colors.foregroundSecondary,
    ...typography.bodySmall,
    ...(textStyle ?? {}),
  };

  return (
    <View style={[styles.row, style]}>
      <Text style={[resolvedTextStyle, styles.party]} numberOfLines={1}>
        {to}
      </Text>
      <View style={{ marginHorizontal: spacing.xs }}>
        <ArrowLeft size={iconSize} color={resolvedIconColor} />
      </View>
      <Text style={[resolvedTextStyle, styles.party]} numberOfLines={1}>
        {from}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  party: {
    flexShrink: 1,
  },
});
