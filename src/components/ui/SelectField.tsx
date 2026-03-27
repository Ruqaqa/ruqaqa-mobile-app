import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActionSheetIOS, Platform, Modal, FlatList } from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { useTheme } from '@/theme';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label?: string;
  value: string | null;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onClear?: () => void;
}

export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  onClear,
}: SelectFieldProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      const labels = [...options.map((o) => o.label), 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: labels.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex < options.length) {
            onChange(options[buttonIndex].value);
          }
        },
      );
    } else {
      setModalVisible(true);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setModalVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text
          style={[
            typography.label,
            { color: colors.foreground, marginBottom: spacing.xs },
          ]}
        >
          {label}
        </Text>
      )}
      <Pressable
        onPress={handlePress}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: colors.input,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
        testID={`select-field-${label}`}
      >
        <Text
          style={[
            {
              fontSize: typography.bodyMedium.fontSize,
              color: selectedOption
                ? colors.foreground
                : colors.foregroundSecondary,
              flex: 1,
            },
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder || ''}
        </Text>
        {value && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            style={styles.clearButton}
            testID={`select-clear-${label}`}
          >
            <X size={16} color={colors.foregroundSecondary} />
          </Pressable>
        ) : (
          <ChevronDown size={18} color={colors.foregroundSecondary} />
        )}
      </Pressable>

      {/* Android bottom sheet modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <View />
        </Pressable>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surface,
              borderTopStartRadius: radius.lg,
              borderTopEndRadius: radius.lg,
            },
          ]}
        >
          {label && (
            <Text
              style={[
                typography.headingSmall,
                {
                  color: colors.foreground,
                  paddingHorizontal: spacing.base,
                  paddingTop: spacing.base,
                  paddingBottom: spacing.sm,
                },
              ]}
            >
              {label}
            </Text>
          )}
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item.value)}
                style={[
                  styles.modalOption,
                  {
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.md,
                    backgroundColor:
                      item.value === value ? colors.muted : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodyLarge,
                    {
                      color:
                        item.value === value
                          ? colors.primary
                          : colors.foreground,
                      fontWeight: item.value === value ? '600' : '400',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
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
  clearButton: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    maxHeight: '50%',
    paddingBottom: 32,
  },
  modalOption: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
});
