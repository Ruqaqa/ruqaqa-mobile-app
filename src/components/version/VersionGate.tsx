import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wrench, Download } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button } from '../ui/Button';
import { VersionCheckResult } from '../../types/version';
import { checkAppVersion } from '../../services/versionCheckService';
import { isFirstLaunch, markLaunched } from '../../services/appLifecycle';

interface VersionGateProps {
  children: React.ReactNode;
}

/**
 * Wraps the app and checks version on startup.
 * - First launch: blocks until version check completes
 * - Subsequent launches: non-blocking background check
 * Shows maintenance, forced update, or optional update overlays as needed.
 */
export function VersionGate({ children }: VersionGateProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  const [checking, setChecking] = useState(true);
  const [result, setResult] = useState<VersionCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const runCheck = useCallback(async () => {
    const vResult = await checkAppVersion();
    setResult(vResult);
    return vResult;
  }, []);

  useEffect(() => {
    async function init() {
      const first = await isFirstLaunch();
      if (first) {
        // First launch: blocking check
        await runCheck();
        await markLaunched();
        setChecking(false);
      } else {
        // Subsequent: show app immediately, check in background
        setChecking(false);
        runCheck();
      }
    }
    init();
  }, [runCheck]);

  // While checking on first launch, show nothing (splash screen still visible)
  if (checking) return null;

  const showMaintenance = result?.maintenanceMode && !dismissed;
  const showForceUpdate = result?.updateRequired && !result.maintenanceMode && !dismissed;
  const showOptionalUpdate =
    result?.updateAvailable &&
    !result.updateRequired &&
    !result.maintenanceMode &&
    !dismissed;

  return (
    <>
      {children}

      {/* Maintenance mode — full screen blocker */}
      {showMaintenance && (
        <View style={[styles.blocker, { backgroundColor: colors.background }]}>
          <View style={[styles.blockerContent, { paddingHorizontal: spacing.xl }]}>
            <Wrench size={48} color={colors.warning} />
            <Text
              style={[
                typography.displayMedium,
                {
                  color: colors.foreground,
                  textAlign: 'center',
                  marginTop: spacing.lg,
                },
              ]}
            >
              {t('maintenance')}
            </Text>
            <Text
              style={[
                typography.bodyLarge,
                {
                  color: colors.foregroundSecondary,
                  textAlign: 'center',
                  marginTop: spacing.md,
                },
              ]}
            >
              {result?.maintenanceMessage ?? t('maintenanceMessage')}
            </Text>
            <View style={{ marginTop: spacing.xxl, width: '100%' }}>
              <Button
                testID="maintenance-retry"
                title={t('retry')}
                onPress={async () => {
                  const fresh = await runCheck();
                  if (!fresh?.maintenanceMode) setDismissed(true);
                }}
                variant="outline"
                size="lg"
              />
            </View>
          </View>
        </View>
      )}

      {/* Forced update — full screen blocker */}
      {showForceUpdate && (
        <View style={[styles.blocker, { backgroundColor: colors.background }]}>
          <View style={[styles.blockerContent, { paddingHorizontal: spacing.xl }]}>
            <Download size={48} color={colors.primary} />
            <Text
              style={[
                typography.displayMedium,
                {
                  color: colors.foreground,
                  textAlign: 'center',
                  marginTop: spacing.lg,
                },
              ]}
            >
              {result?.updateTitle ?? t('updateRequired')}
            </Text>
            <Text
              style={[
                typography.bodyLarge,
                {
                  color: colors.foregroundSecondary,
                  textAlign: 'center',
                  marginTop: spacing.md,
                },
              ]}
            >
              {result?.updateMessage ?? t('updateRequiredMessage')}
            </Text>
            {result?.releaseNotes && (
              <View
                style={[
                  styles.releaseNotes,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginTop: spacing.base,
                    ...shadows.sm,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.foreground }]}>
                  {t('whatsNew')}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.foregroundSecondary, marginTop: spacing.xs },
                  ]}
                >
                  {result.releaseNotes}
                </Text>
              </View>
            )}
            <View style={{ marginTop: spacing.xxl, width: '100%' }}>
              {result?.downloadUrl ? (
                <Button
                  testID="force-update-button"
                  title={t('updateNow')}
                  onPress={() => Linking.openURL(result.downloadUrl!)}
                  variant="gradient"
                  size="lg"
                />
              ) : (
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: colors.error, textAlign: 'center' },
                  ]}
                >
                  {t('updateRequiredNoUrl')}
                </Text>
              )}
              {__DEV__ && (
                <Button
                  testID="dev-skip-update"
                  title="Skip (dev only)"
                  onPress={() => setDismissed(true)}
                  variant="ghost"
                  size="sm"
                />
              )}
            </View>
          </View>
        </View>
      )}

      {/* Optional update — bottom sheet modal */}
      {showOptionalUpdate && result?.downloadUrl && (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={() => setDismissed(true)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setDismissed(true)}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing.xxl,
                paddingTop: spacing.md,
              },
            ]}
          >
            {/* Drag handle */}
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: colors.border, borderRadius: radius.full },
              ]}
            />

            <Text
              style={[
                typography.headingLarge,
                {
                  color: colors.foreground,
                  marginTop: spacing.lg,
                },
              ]}
            >
              {result?.updateTitle ?? t('updateAvailable')}
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                {
                  color: colors.foregroundSecondary,
                  marginTop: spacing.sm,
                },
              ]}
            >
              {result?.updateMessage ?? t('updateAvailableMessage')}
            </Text>
            {result?.releaseNotes && (
              <Text
                style={[
                  typography.bodySmall,
                  {
                    color: colors.foregroundSecondary,
                    marginTop: spacing.md,
                  },
                ]}
              >
                {result.releaseNotes}
              </Text>
            )}
            <View style={[styles.sheetButtons, { marginTop: spacing.lg, gap: spacing.md }]}>
              <Pressable
                onPress={() => setDismissed(true)}
                style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.base }}
              >
                <Text style={[typography.bodyMedium, { color: colors.foregroundSecondary }]}>
                  {t('later')}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button
                  testID="optional-update-button"
                  title={t('updateNow')}
                  onPress={() => Linking.openURL(result.downloadUrl!)}
                  variant="default"
                  size="lg"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  blocker: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockerContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  releaseNotes: {
    width: '100%',
    maxHeight: 200,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dragHandle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
  },
  sheetButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
