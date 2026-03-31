import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppModule } from '../../src/types/permissions';
import { getAvailableModules } from '../../src/services/permissionService';
import { useAuth } from '../../src/services/authContext';
import { AppModuleContext } from '../../src/navigation/AppModuleContext';
import { FinanceShell } from '../../src/navigation/FinanceShell';
import { GalleryShell } from '../../src/navigation/GalleryShell';
import { ModuleSwitcherSheet } from '../../src/components/layout/ModuleSwitcherSheet';
import { NoAccessScreen } from '../../src/components/layout/NoAccessScreen';
import { ErrorBoundary } from '../../src/components/layout/ErrorBoundary';
import { useTheme } from '../../src/theme';
import { useShareIntent } from '../../src/hooks/useShareIntent';
import { FlowSelectorSheet } from '../../src/components/share';
import type { ShareFlowTarget } from '../../src/components/share';
import { shareIntentStore } from '../../src/services/shareIntent';

/**
 * Main authenticated app layout.
 * Manages the active module (Finance / Gallery) and renders the appropriate shell.
 * Uses IndexedStack-like pattern to preserve state across module switches.
 * Now reads real permissions from AuthContext (Phase 1).
 */
export default function AppLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, permissions } = useAuth();

  // Guard: redirect to login if not authenticated (deep link protection)
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // Use real permissions from auth context, fall back to no-access if null
  const effectivePermissions = permissions ?? {
    canAccessFinance: false,
    canAccessGallery: false,
    canCreateTransactions: false,
    canViewTransactionHistory: false,
    canViewAllTransactions: false,
    canUpdateTransactions: false,
    canSelectPartner: false,
    canAddReceiptsToSubmitted: false,
    canCreateReconciliation: false,
    canViewReconciliationHistory: false,
    canViewAllReconciliations: false,
    canUpdateReconciliation: false,
    canViewGallery: false,
    canCreateGallery: false,
    canDeleteGallery: false,
  };

  const availableModules = useMemo(
    () => getAvailableModules(effectivePermissions),
    [effectivePermissions],
  );

  const [activeModule, setActiveModule] = useState<AppModule>(
    availableModules[0] ?? 'finance',
  );
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const openSwitcher = useCallback(() => setSwitcherVisible(true), []);
  const closeSwitcher = useCallback(() => setSwitcherVisible(false), []);

  const switchTo = useCallback(
    (mod: AppModule) => {
      setActiveModule(mod);
      setSwitcherVisible(false);
    },
    [],
  );

  // Share intent: show flow selector when files arrive
  const { hasPendingFiles, pendingFiles, selectFlow, clear: clearShareIntent } = useShareIntent();
  const [flowSelectorVisible, setFlowSelectorVisible] = useState(false);

  useEffect(() => {
    if (hasPendingFiles) {
      setFlowSelectorVisible(true);
    }
  }, [hasPendingFiles]);

  const handleFlowSelect = useCallback((target: ShareFlowTarget) => {
    selectFlow(target);
    setFlowSelectorVisible(false);
  }, [selectFlow]);

  const handleFlowDismiss = useCallback(() => {
    clearShareIntent();
    setFlowSelectorVisible(false);
  }, [clearShareIntent]);

  const handleRemoveSharedFile = useCallback((index: number) => {
    const state = shareIntentStore.getState();
    if (state.status === 'files_received') {
      const remaining = state.files.filter((_, i) => i !== index);
      if (remaining.length === 0) {
        shareIntentStore.clear();
        setFlowSelectorVisible(false);
      } else {
        shareIntentStore.setFiles(remaining);
      }
    }
  }, []);

  // Map store SharedFile (fileName: string | null) to component SharedFile (fileName: string)
  const flowSelectorFiles = useMemo(
    () => pendingFiles.map((f) => ({
      uri: f.uri,
      mimeType: f.mimeType,
      fileName: f.fileName ?? `file.${f.mimeType.split('/')[1] ?? 'bin'}`,
    })),
    [pendingFiles],
  );

  const canSwitch = availableModules.length > 1;

  const ctxValue = useMemo(
    () => ({
      activeModule,
      availableModules,
      canSwitch,
      permissions: effectivePermissions,
      openSwitcher,
    }),
    [activeModule, availableModules, canSwitch, effectivePermissions, openSwitcher],
  );

  if (availableModules.length === 0) {
    return <NoAccessScreen />;
  }

  return (
    <SafeAreaProvider>
      <AppModuleContext.Provider value={ctxValue}>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          {/* Both shells are always mounted to preserve state (like IndexedStack) */}
          <View
            style={[styles.shell, { display: activeModule === 'finance' ? 'flex' : 'none' }]}
          >
            <ErrorBoundary>
              <FinanceShell />
            </ErrorBoundary>
          </View>
          <View
            style={[styles.shell, { display: activeModule === 'gallery' ? 'flex' : 'none' }]}
          >
            <ErrorBoundary>
              <GalleryShell />
            </ErrorBoundary>
          </View>

          <ModuleSwitcherSheet
            visible={switcherVisible}
            activeModule={activeModule}
            availableModules={availableModules}
            onSelect={switchTo}
            onClose={closeSwitcher}
          />

          <FlowSelectorSheet
            visible={flowSelectorVisible}
            files={flowSelectorFiles}
            onSelect={handleFlowSelect}
            onDismiss={handleFlowDismiss}
            onRemoveFile={handleRemoveSharedFile}
          />
        </View>
      </AppModuleContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shell: { flex: 1 },
});
