import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  maxDate?: Date;
  minDate?: Date;
  placeholder?: string;
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  maxDate,
  minDate,
  placeholder = 'Select date',
  error,
}: DatePickerFieldProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const formatDisplayDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          typography.label,
          { color: colors.foreground, marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.input,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Calendar size={16} color={colors.foregroundSecondary} />
        <Text
          style={[
            typography.bodyMedium,
            {
              color: value ? colors.foreground : colors.foregroundSecondary,
              marginStart: spacing.sm,
              flex: 1,
            },
          ]}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
        {value && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <X size={14} color={colors.foregroundSecondary} />
          </Pressable>
        )}
      </Pressable>
      {error && (
        <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.xxs }]}>
          {error}
        </Text>
      )}
      {showPicker && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  field: {
    height: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
