import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Search, X, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

interface FilterBarProps {
  showOwn: boolean;
  onShowOwnChange: (value: boolean) => void;
  canViewAll: boolean;
  hasActiveFilters: boolean;
  onSearchPress: () => void;
  onClearFilters: () => void;
  ownLabel: string;
  allLabel: string;
}

export const FilterBar = React.memo(function FilterBar({
  showOwn,
  onShowOwnChange,
  canViewAll,
  hasActiveFilters,
  onSearchPress,
  onClearFilters,
  ownLabel,
  allLabel,
}: FilterBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const segments = [
    { value: 'mine' as const, label: ownLabel },
    { value: 'all' as const, label: allLabel },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.base,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Search button */}
      <Pressable
        onPress={onSearchPress}
        style={styles.searchButton}
        accessibilityLabel={t('search')}
        testID="filter-bar-search"
      >
        <Search size={20} color={colors.foreground} />
        {hasActiveFilters && (
          <View
            style={[
              styles.filterDot,
              { backgroundColor: colors.error },
            ]}
          />
        )}
      </Pressable>

      {/* Center: SegmentedControl or static label */}
      <View style={styles.center}>
        {canViewAll ? (
          <SegmentedControl
            segments={segments}
            value={showOwn ? 'mine' : 'all'}
            onChange={(val) => onShowOwnChange(val === 'mine')}
          />
        ) : (
          <View style={styles.staticLabel}>
            <User size={16} color={colors.foregroundSecondary} />
            <Text
              style={{
                color: colors.foregroundSecondary,
                marginStart: spacing.xs,
                fontSize: 14,
                fontWeight: '500',
              }}
            >
              {ownLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Clear filters button */}
      {hasActiveFilters ? (
        <Pressable
          onPress={onClearFilters}
          style={[
            styles.clearButton,
            {
              backgroundColor: colors.error,
              borderRadius: radius.full,
            },
          ]}
          accessibilityLabel={t('clearFilters')}
          testID="filter-bar-clear"
        >
          <X size={16} color={colors.onError} />
        </Pressable>
      ) : (
        <View style={styles.clearPlaceholder} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  searchButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    end: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  center: {
    flex: 1,
    marginHorizontal: 12,
  },
  staticLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPlaceholder: {
    width: 32,
  },
});
