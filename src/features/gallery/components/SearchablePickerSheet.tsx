import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import {
  Search,
  X as XIcon,
  Check,
  Circle,
  PlusCircle,
  SearchX,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { Button } from '@/components/ui/Button';

interface SearchablePickerSheetProps<T> {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Whether multiple items can be selected (true) or just one (false). */
  multiSelect: boolean;
  /** Called whenever multi-selection changes. */
  onMultiSelectionChanged?: (items: T[]) => void;
  /** Called when a single item is selected (single-select mode). */
  onSingleSelect?: (item: T) => void;
  /** Search function — receives query, returns matching items. */
  onSearch: (query: string) => Promise<T[]>;
  /** Extract display label from an item. */
  displayString: (item: T) => string;
  /** Extract unique ID from an item. */
  itemId: (item: T) => string;
  /** Currently selected items. */
  initialSelection: T[];
  /** Whether the inline "Create" row appears when search has no exact match. */
  allowCreate?: boolean;
  /** Create a new item from the search query text. */
  onCreate?: (name: string) => Promise<T | null>;
  /** Label prefix for the inline create row (e.g. "Create tag"). */
  createLabel?: string;
  /** Search input placeholder. */
  searchHint: string;
  /** Label shown when results are empty. */
  emptyLabel: string;
  /** "New" button in the title bar that opens a dedicated creation sheet. */
  onPersistentCreate?: () => Promise<T | null>;
  /** Label for the persistent create button. */
  persistentCreateLabel?: string;
}

/**
 * A reusable bottom sheet with search, multi/single-select, and inline creation.
 * Mirrors Flutter's SearchablePickerSheet from widgets/searchable_picker_sheet.dart.
 */
export function SearchablePickerSheet<T>({
  visible,
  onClose,
  title,
  multiSelect,
  onMultiSelectionChanged,
  onSingleSelect,
  onSearch,
  displayString,
  itemId,
  initialSelection,
  allowCreate = false,
  onCreate,
  createLabel = '',
  searchHint,
  emptyLabel,
  onPersistentCreate,
  persistentCreateLabel,
}: SearchablePickerSheetProps<T>) {
  const { colors, typography, spacing, radius } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [selected, setSelected] = useState<T[]>(initialSelection);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync initial selection when sheet opens
  useEffect(() => {
    if (visible) {
      setSelected(initialSelection);
      setQuery('');
      // Trigger initial search
      doSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const doSearch = useCallback(
    async (q: string) => {
      setIsLoading(true);
      try {
        const items = await onSearch(q);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSearch(text);
      }, 300);
    },
    [doSearch],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    doSearch('');
    inputRef.current?.focus();
  }, [doSearch]);

  const isItemSelected = useCallback(
    (item: T) => selected.some((s) => itemId(s) === itemId(item)),
    [selected, itemId],
  );

  const toggleItem = useCallback(
    (item: T) => {
      if (!multiSelect) {
        onSingleSelect?.(item);
        onClose();
        return;
      }

      setSelected((prev) => {
        const id = itemId(item);
        const isSelected = prev.some((s) => itemId(s) === id);
        const next = isSelected
          ? prev.filter((s) => itemId(s) !== id)
          : [...prev, item];
        onMultiSelectionChanged?.(next);
        return next;
      });
    },
    [multiSelect, itemId, onMultiSelectionChanged, onSingleSelect, onClose],
  );

  // Whether the "Create" row should be shown
  const trimmedQuery = query.trim();
  const showCreateRow =
    allowCreate &&
    trimmedQuery.length > 0 &&
    !results.some(
      (r) => displayString(r).toLowerCase() === trimmedQuery.toLowerCase(),
    );

  const handleCreate = useCallback(async () => {
    if (!onCreate || trimmedQuery.length === 0) return;
    setIsCreating(true);
    try {
      const newItem = await onCreate(trimmedQuery);
      if (!newItem) return;

      setResults((prev) => [newItem, ...prev]);

      if (multiSelect) {
        setSelected((prev) => {
          const id = itemId(newItem);
          if (prev.some((s) => itemId(s) === id)) return prev;
          const next = [...prev, newItem];
          onMultiSelectionChanged?.(next);
          return next;
        });
        setQuery('');
        doSearch('');
      } else {
        onSingleSelect?.(newItem);
        onClose();
      }
    } finally {
      setIsCreating(false);
    }
  }, [
    onCreate,
    trimmedQuery,
    multiSelect,
    itemId,
    onMultiSelectionChanged,
    onSingleSelect,
    onClose,
    doSearch,
  ]);

  const handlePersistentCreate = useCallback(async () => {
    if (!onPersistentCreate) return;
    const newItem = await onPersistentCreate();
    if (!newItem) return;

    setResults((prev) => {
      const id = itemId(newItem);
      if (prev.some((r) => itemId(r) === id)) return prev;
      return [newItem, ...prev];
    });

    if (multiSelect) {
      setSelected((prev) => {
        const id = itemId(newItem);
        if (prev.some((s) => itemId(s) === id)) return prev;
        const next = [...prev, newItem];
        onMultiSelectionChanged?.(next);
        return next;
      });
    } else {
      onSingleSelect?.(newItem);
      onClose();
    }
  }, [
    onPersistentCreate,
    itemId,
    multiSelect,
    onMultiSelectionChanged,
    onSingleSelect,
    onClose,
  ]);

  const renderItem: ListRenderItem<T> = useCallback(
    ({ item }) => {
      const sel = isItemSelected(item);
      return (
        <Pressable
          onPress={() => toggleItem(item)}
          style={({ pressed }) => [
            styles.listItem,
            {
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              backgroundColor: pressed
                ? withAlpha(colors.primary, 0.06)
                : 'transparent',
            },
          ]}
        >
          {multiSelect ? (
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: sel ? colors.primary : colors.foregroundSecondary,
                  backgroundColor: sel ? colors.primary : 'transparent',
                  borderRadius: 4,
                },
              ]}
            >
              {sel && <Check size={14} color={colors.onPrimary} />}
            </View>
          ) : (
            sel ? (
              <Check size={20} color={colors.primary} />
            ) : (
              <Circle size={20} color={colors.foregroundSecondary} />
            )
          )}
          <Text
            style={[
              typography.bodyMedium,
              {
                color: sel ? colors.primary : colors.foreground,
                fontWeight: sel ? '600' : '400',
                marginStart: spacing.md,
                flex: 1,
              },
            ]}
            numberOfLines={1}
          >
            {displayString(item)}
          </Text>
        </Pressable>
      );
    },
    [
      isItemSelected,
      toggleItem,
      multiSelect,
      displayString,
      colors,
      typography,
      spacing,
    ],
  );

  const keyExtractor = useCallback(
    (item: T) => itemId(item),
    [itemId],
  );

  // Create row component
  const CreateRow = showCreateRow ? (
    <Pressable
      onPress={isCreating ? undefined : handleCreate}
      style={[
        styles.listItem,
        {
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          backgroundColor: withAlpha(colors.primary, 0.04),
        },
      ]}
    >
      {isCreating ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <PlusCircle size={20} color={colors.primary} />
      )}
      <Text
        style={[
          typography.bodyMedium,
          {
            color: colors.primary,
            fontWeight: '500',
            marginStart: spacing.md,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {createLabel} &ldquo;{trimmedQuery}&rdquo;
      </Text>
    </Pressable>
  ) : null;

  // Empty state
  const EmptyState =
    !isLoading && results.length === 0 && !showCreateRow ? (
      <View style={styles.emptyContainer}>
        <SearchX size={48} color={colors.foregroundSecondary} />
        <Text
          style={[
            typography.bodyMedium,
            {
              color: colors.foregroundSecondary,
              marginTop: spacing.md,
              textAlign: 'center',
            },
          ]}
        >
          {emptyLabel}
        </Text>
      </View>
    ) : null;

  if (!visible) return null;

  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            height: screenHeight * 0.7,
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.lg,
            borderTopEndRadius: radius.lg,
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Close button */}
        <View style={[styles.closeRow, { paddingHorizontal: spacing.base }]}>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} style={styles.closeButton}>
            <XIcon size={20} color={colors.foregroundSecondary} />
          </Pressable>
        </View>

        {/* Title bar */}
        <View
          style={[
            styles.titleRow,
            { paddingHorizontal: spacing.base, marginBottom: spacing.sm },
          ]}
        >
          <Text
            style={[
              typography.headingSmall,
              { color: colors.foreground, flex: 1 },
            ]}
          >
            {title}
          </Text>
          {onPersistentCreate && persistentCreateLabel && (
            <Button
              title={persistentCreateLabel}
              variant="ghost"
              size="sm"
              onPress={handlePersistentCreate}
            />
          )}
        </View>

        {/* Search input */}
        <View
          style={[
            styles.searchRow,
            {
              borderColor: colors.input,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.md,
              marginHorizontal: spacing.base,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <Search size={16} color={colors.foregroundSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={handleSearchChange}
            placeholder={searchHint}
            placeholderTextColor={colors.foregroundSecondary}
            style={[
              styles.searchInput,
              {
                color: colors.foreground,
                fontSize: typography.bodyMedium.fontSize,
                marginStart: spacing.sm,
              },
            ]}
            autoCorrect={false}
            returnKeyType="search"
            maxLength={200}
          />
          {query.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <XIcon size={16} color={colors.foregroundSecondary} />
            </Pressable>
          )}
        </View>

        {/* Loading indicator */}
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginBottom: spacing.sm }}
          />
        )}

        {/* Results list */}
        {EmptyState || (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={CreateRow}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    padding: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
});
