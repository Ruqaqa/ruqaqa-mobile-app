import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useAppModuleContext } from './AppModuleContext';
import {
  getAvailableFinanceTabs,
  FinanceTab,
} from '../services/permissionService';
import { AppBar } from '../components/layout/AppBar';
import { TransactionHistoryScreen } from '../features/transactions/components/TransactionHistoryScreen';

// Placeholder tab content — replaced per-feature in later phases
function PlaceholderTab({ label }: { label: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
      <Text style={[typography.headingMedium, { color: colors.foregroundSecondary }]}>
        {label}
      </Text>
      <Text style={[typography.bodySmall, { color: colors.foregroundSecondary, marginTop: spacing.sm }]}>
        Coming in Phase 3-5
      </Text>
    </View>
  );
}

/**
 * Finance module shell with bottom tab navigation.
 *
 * Tabs: Operations, Reconciliation, Payroll (permission-gated).
 * Within Operations and Reconciliation, a segmented control switches
 * between "Add" and "History" sub-views.
 */
export function FinanceShell() {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const { permissions } = useAppModuleContext();

  const tabs = useMemo(
    () => getAvailableFinanceTabs(permissions),
    [permissions],
  );
  const [activeTab, setActiveTab] = useState<FinanceTab>(tabs[0] ?? 'operations');

  const tabLabels: Record<FinanceTab, string> = {
    operations: t('operations'),
    reconciliation: t('reconciliation'),
    payroll: t('payroll'),
  };

  const tabIcons: Record<FinanceTab, string> = {
    operations: 'receipt',
    reconciliation: 'arrow-left-right',
    payroll: 'banknote',
  };

  if (tabs.length === 0) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
        <Text style={[typography.bodyLarge, { color: colors.foregroundSecondary }]}>
          No finance permissions
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AppBar />

      {/* Tab content — all mounted, show/hide for state preservation */}
      <View style={styles.content}>
        {tabs.map((tab) => (
          <View
            key={tab}
            style={[
              styles.tabContent,
              { display: activeTab === tab ? 'flex' : 'none' },
            ]}
          >
            {tab === 'operations' ? (
              <TransactionHistoryScreen permissions={permissions} />
            ) : (
              <PlaceholderTab label={tabLabels[tab]} />
            )}
          </View>
        ))}
      </View>

      {/* Bottom tab bar — only show if more than one tab */}
      {tabs.length > 1 && (
        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={styles.tabItem}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tabLabels[tab]}
              >
                <View
                  style={[
                    styles.tabIndicator,
                    {
                      backgroundColor: isActive ? colors.primary : 'transparent',
                      borderRadius: radius.full,
                    },
                  ]}
                />
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: isActive ? colors.primary : colors.foregroundSecondary,
                      marginTop: spacing.xxs,
                    },
                  ]}
                >
                  {tabLabels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabContent: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 56,
  },
  tabIndicator: {
    width: 4,
    height: 4,
  },
});
