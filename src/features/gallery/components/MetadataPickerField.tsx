import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  ChevronDown,
  X,
  ImageIcon,
  Tag,
  FolderOpen,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

type IconName = 'album' | 'tag' | 'folder';

interface MetadataPickerFieldProps<T> {
  label: string;
  hint: string;
  iconName: IconName;
  selectedItems: T[];
  displayString: (item: T) => string;
  itemId: (item: T) => string;
  onPress: () => void;
  onRemove: (item: T) => void;
  isRequired?: boolean;
}

const iconMap: Record<IconName, React.ComponentType<any>> = {
  album: ImageIcon,
  tag: Tag,
  folder: FolderOpen,
};

/**
 * A tappable metadata field that shows selected items as chips.
 * Used for album, tag, and project pickers on the upload screen.
 */
export function MetadataPickerField<T>({
  label,
  hint,
  iconName,
  selectedItems,
  displayString,
  itemId,
  onPress,
  onRemove,
  isRequired = false,
}: MetadataPickerFieldProps<T>) {
  const { colors, typography, spacing, radius } = useTheme();
  const IconComponent = iconMap[iconName];
  const hasItems = selectedItems.length > 0;

  return (
    <View style={[styles.wrapper, { marginBottom: spacing.md }]}>
      {/* Label row */}
      <View style={styles.labelRow}>
        <Text
          style={[
            typography.label,
            { color: colors.foreground },
          ]}
        >
          {label}
        </Text>
        {isRequired && (
          <Text style={[typography.bodySmall, { color: colors.error, marginStart: spacing.xs }]}>
            *
          </Text>
        )}
      </View>

      {/* Tappable field */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: colors.input,
            borderRadius: radius.md,
            backgroundColor: pressed ? withAlpha(colors.primary, 0.03) : colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: hasItems ? spacing.sm : 0,
            minHeight: 44,
          },
        ]}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {hasItems ? (
          <View style={styles.chipsContainer}>
            {selectedItems.map((item) => (
              <View
                key={itemId(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: withAlpha(colors.green, 0.12),
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    marginEnd: spacing.xs,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: colors.green },
                  ]}
                  numberOfLines={1}
                >
                  {displayString(item)}
                </Text>
                <Pressable
                  onPress={() => onRemove(item)}
                  hitSlop={6}
                  style={{ marginStart: spacing.xs, padding: 2 }}
                  accessibilityLabel={`Remove ${displayString(item)}`}
                >
                  <X size={12} color={colors.green} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.hintRow}>
            <IconComponent size={18} color={colors.foregroundSecondary} />
            <Text
              style={[
                typography.bodyMedium,
                {
                  color: colors.foregroundSecondary,
                  flex: 1,
                  marginStart: spacing.sm,
                },
              ]}
              numberOfLines={1}
            >
              {hint}
            </Text>
            <ChevronDown size={18} color={colors.foregroundSecondary} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  field: {
    borderWidth: 1,
    justifyContent: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
