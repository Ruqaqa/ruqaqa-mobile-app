import React from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { useTheme } from '../../theme';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const { colors, typography, radius } = useTheme();

  const handlePress = (segmentValue: T) => {
    if (disabled || segmentValue === value) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'),
    );
    onChange(segmentValue);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.muted,
          borderRadius: radius.full,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {segments.map((segment) => {
        const isActive = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => handlePress(segment.value)}
            style={[
              styles.segment,
              {
                backgroundColor: isActive ? colors.primary : 'transparent',
                borderRadius: radius.full,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled }}
            testID={`segment-${segment.value}`}
          >
            <Text
              style={[
                typography.label,
                {
                  color: isActive ? colors.onPrimary : colors.foregroundSecondary,
                },
              ]}
            >
              {segment.label}
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
    height: 36,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
