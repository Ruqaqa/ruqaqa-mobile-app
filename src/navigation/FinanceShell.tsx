import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { useAppModuleContext } from './AppModuleContext';
import { useAuth } from '../services/authContext';
import {
  getAvailableFinanceTabs,
  FinanceTab,
} from '../services/permissionService';
import { AppBar } from '../components/layout/AppBar';
import { TransactionHistoryScreen } from '../features/transactions/components/TransactionHistoryScreen';
import { TransactionFormScreen } from '../features/transactions/components/TransactionFormScreen';
import { ReconciliationHistoryScreen } from '../features/reconciliation/components/ReconciliationHistoryScreen';
import { ReconciliationFormScreen } from '../features/reconciliation/components/ReconciliationFormScreen';
import { useShareIntent } from '../hooks/useShareIntent';

/**
 * Finance module shell with bottom tab navigation.
 *
 * Tabs: Operations, Reconciliation (permission-gated).
 * FAB on Operations tab opens the Transaction Form as a full-screen modal.
 */
export function FinanceShell() {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const { permissions } = useAppModuleContext();
  const { employee } = useAuth();

  const tabs = useMemo(
    () => getAvailableFinanceTabs(permissions),
    [permissions],
  );
  const [activeTab, setActiveTab] = useState<FinanceTab>(tabs[0] ?? 'operations');
  const [formVisible, setFormVisible] = useState(false);
  const [reconciliationFormVisible, setReconciliationFormVisible] = useState(false);
  const { state: shareState } = useShareIntent();

  // Auto-open form when share intent targets a finance flow
  useEffect(() => {
    if (shareState.status === 'flow_selected') {
      if (shareState.targetId === 'transaction') {
        setFormVisible(true);
      } else if (shareState.targetId === 'reconciliation') {
        setActiveTab('reconciliation');
        setReconciliationFormVisible(true);
      }
    }
  }, [shareState]);

  const tabLabels: Record<FinanceTab, string> = {
    operations: t('operations'),
    reconciliation: t('reconciliation'),
  };

  const tabIcons: Record<FinanceTab, string> = {
    operations: 'receipt',
    reconciliation: 'arrow-left-right',
  };

  const openForm = useCallback(() => setFormVisible(true), []);
  const closeForm = useCallback(() => setFormVisible(false), []);
  const openReconciliationForm = useCallback(() => setReconciliationFormVisible(true), []);
  const closeReconciliationForm = useCallback(() => setReconciliationFormVisible(false), []);

  const transactionListRef = useRef<{ refresh: () => void } | null>(null);
  const reconciliationListRef = useRef<{ refresh: () => void } | null>(null);

  const handleTransactionListReady = useCallback(
    (api: { refresh: () => void }) => {
      transactionListRef.current = api;
    },
    [],
  );
  const handleReconciliationListReady = useCallback(
    (api: { refresh: () => void }) => {
      reconciliationListRef.current = api;
    },
    [],
  );

  const handleTransactionSubmitted = useCallback(() => {
    transactionListRef.current?.refresh();
  }, []);
  const handleReconciliationSubmitted = useCallback(() => {
    reconciliationListRef.current?.refresh();
  }, []);

  const showTransactionFab = activeTab === 'operations' && permissions.canCreateTransactions;
  const showReconciliationFab = activeTab === 'reconciliation' && permissions.canCreateReconciliation;

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
              <TransactionHistoryScreen
                permissions={permissions}
                onReady={handleTransactionListReady}
              />
            ) : (
              <ReconciliationHistoryScreen
                permissions={permissions}
                onReady={handleReconciliationListReady}
              />
            )}
          </View>
        ))}
      </View>

      {/* FAB — only on Operations tab with create permission */}
      {showTransactionFab && (
        <Pressable
          onPress={openForm}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              opacity: pressed ? 0.85 : 1,
              ...shadows.gradient,
            },
          ]}
          accessibilityLabel={t('newTransaction')}
          accessibilityRole="button"
          testID="fab-new-transaction"
        >
          <Plus size={28} color={colors.onPrimary} strokeWidth={2.5} />
        </Pressable>
      )}

      {/* FAB — only on Reconciliation tab with create permission */}
      {showReconciliationFab && (
        <Pressable
          onPress={openReconciliationForm}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              opacity: pressed ? 0.85 : 1,
              ...shadows.gradient,
            },
          ]}
          accessibilityLabel={t('newReconciliation')}
          accessibilityRole="button"
          testID="fab-new-reconciliation"
        >
          <Plus size={28} color={colors.onPrimary} strokeWidth={2.5} />
        </Pressable>
      )}

      {/* Transaction Form Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeForm}
      >
        <TransactionFormScreen
          permissions={permissions}
          employee={employee}
          onClose={closeForm}
          onSubmitted={handleTransactionSubmitted}
        />
      </Modal>

      {/* Reconciliation Form Modal */}
      <Modal
        visible={reconciliationFormVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeReconciliationForm}
      >
        <ReconciliationFormScreen
          onClose={closeReconciliationForm}
          onSubmitted={handleReconciliationSubmitted}
        />
      </Modal>

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
  fab: {
    position: 'absolute',
    bottom: 80,
    end: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
