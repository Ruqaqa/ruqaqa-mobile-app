import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { X, Search } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

export interface AutocompleteItem {
  id: string;
  label: string;
}

interface AutocompleteFieldProps<T extends AutocompleteItem> {
  label?: string;
  placeholder?: string;
  value: T | null;
  onSearch: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  onClear: () => void;
  onTextChange?: (text: string) => void;
  error?: string;
  debounceMs?: number;
  minChars?: number;
  testID?: string;
  allowFreeText?: boolean;
}

export function AutocompleteField<T extends AutocompleteItem>({
  label,
  placeholder,
  value,
  onSearch,
  onSelect,
  onClear,
  onTextChange,
  error,
  debounceMs = 300,
  minChars = 1,
  testID,
  allowFreeText = false,
}: AutocompleteFieldProps<T>) {
  const { colors, typography, spacing, radius } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestCounter = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const hasError = !!error;
  const borderColor = hasError
    ? colors.error
    : isFocused
      ? colors.primary
      : colors.input;

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      onTextChange?.(text);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (text.length < minChars) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      const requestId = ++requestCounter.current;
      debounceTimer.current = setTimeout(async () => {
        try {
          const items = await onSearch(text);
          // Only apply results if this is still the latest request
          if (requestId !== requestCounter.current) return;
          setResults(items);
          setShowDropdown(items.length > 0);
        } catch {
          if (requestId !== requestCounter.current) return;
          setResults([]);
          setShowDropdown(false);
        } finally {
          if (requestId === requestCounter.current) {
            setIsLoading(false);
          }
        }
      }, debounceMs);
    },
    [onSearch, debounceMs, minChars, onTextChange],
  );

  const handleSelect = useCallback(
    (item: T) => {
      setQuery('');
      setResults([]);
      setShowDropdown(false);
      Keyboard.dismiss();
      onSelect(item);
    },
    [onSelect],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay hiding dropdown so tap on option can register
    setTimeout(() => setShowDropdown(false), 200);
  }, []);

  // Selected chip view
  if (value) {
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
        <View
          style={[
            styles.chipContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.input,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <View
            style={[
              styles.chip,
              {
                backgroundColor: withAlpha(colors.primary, 0.12),
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.primary, fontWeight: '500' },
              ]}
              numberOfLines={1}
            >
              {value.label}
            </Text>
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              style={{ marginStart: spacing.xs, padding: 2 }}
              accessibilityLabel="Clear selection"
              testID={testID ? `${testID}-clear` : undefined}
            >
              <X size={14} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Input + dropdown view
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
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: isFocused ? 2 : 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Search size={16} color={colors.foregroundSecondary} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={handleSearch}
          placeholder={placeholder}
          placeholderTextColor={colors.foregroundSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          style={[
            styles.textInput,
            {
              color: colors.foreground,
              fontSize: typography.bodyMedium.fontSize,
              marginStart: spacing.sm,
            },
          ]}
          testID={testID}
          autoCorrect={false}
        />
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginStart: spacing.xs }}
          />
        )}
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              marginTop: spacing.xxs,
              ...dropdownShadow,
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 200 }}
            nestedScrollEnabled
          >
            {results.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: colors.border,
                    }}
                  />
                )}
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    {
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed
                        ? withAlpha(colors.primary, 0.08)
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[typography.bodyMedium, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      )}

      {hasError && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, marginTop: spacing.xxs },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const dropdownShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 4,
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  inputRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: 44,
    padding: 0,
  },
  chipContainer: {
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    maxWidth: '90%',
  },
  dropdown: {
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
  },
  dropdownItem: {},
});
