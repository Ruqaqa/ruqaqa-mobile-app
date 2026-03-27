import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme';
import { withAlpha } from '../src/utils/colorUtils';
import { useAuth } from '../src/services/authContext';
import { Button } from '../src/components/ui/Button';
import { LanguageSwitcher } from '../src/components/auth/LanguageSwitcher';
import { LoginStatus } from '../src/types/auth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const { login, logoutMessage, clearLogoutMessage } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Show logout message as banner if present
  useEffect(() => {
    if (logoutMessage) {
      setErrorBanner(t(logoutMessage));
      clearLogoutMessage();
    }
  }, [logoutMessage, clearLogoutMessage, t]);

  const handleMicrosoftSSO = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const result = await login({ idpHint: 'microsoft' });
      if (result.status !== LoginStatus.Success) {
        if (result.message) setErrorBanner(t(result.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeycloakSSO = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const result = await login({});
      if (result.status !== LoginStatus.Success) {
        if (result.message) setErrorBanner(t(result.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar: language switcher */}
        <View style={[styles.topBar, { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.base }]}>
          <LanguageSwitcher />
        </View>

        {/* Error / logout banner */}
        {errorBanner && (
          <View
            testID="error-banner"
            accessibilityRole="alert"
            style={[
              styles.banner,
              {
                backgroundColor: withAlpha(colors.error, 0.1),
                borderRadius: radius.md,
                marginHorizontal: spacing.xl,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, textAlign: 'center' },
              ]}
            >
              {errorBanner}
            </Text>
          </View>
        )}

        {/* Branding */}
        <View style={[styles.branding, { marginTop: spacing.xxl, marginBottom: spacing.xxxl }]}>
          <Image
            source={require('../assets/logo-green.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text
            testID="app-title"
            style={[
              typography.displayMedium,
              { color: colors.primary, textAlign: 'center', marginTop: spacing.lg },
            ]}
          >
            {t('appTitle')}
          </Text>
          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.foregroundSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            {t('financialManagementApp')}
          </Text>
        </View>

        {/* Action area */}
        <View
          style={[styles.actions, { paddingHorizontal: spacing.xl }]}
        >
          {/* Microsoft SSO button */}
          <Button
            testID="sso-microsoft-button"
            title={isLoading ? t('signingIn') : t('signInWithMicrosoft')}
            onPress={handleMicrosoftSSO}
            variant="gradient"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
          />

          {/* Divider */}
          <View style={[styles.divider, { marginVertical: spacing.md }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.foregroundSecondary,
                  paddingHorizontal: spacing.base,
                },
              ]}
            >
              {t('or')}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Keycloak SSO (no idp hint) */}
          <Button
            testID="sso-keycloak-button"
            title={t('signInWithKeycloak')}
            onPress={handleKeycloakSSO}
            variant="outline"
            size="lg"
            disabled={isLoading}
          />

        </View>

        {/* Security footer */}
        <View
          style={[
            styles.securityFooter,
            {
              backgroundColor: withAlpha(colors.primary, 0.1),
              borderRadius: radius.md,
              padding: spacing.base,
              marginHorizontal: spacing.xl,
              marginTop: spacing.xl,
            },
          ]}
        >
          <Text
            style={[
              typography.bodySmall,
              { color: colors.primary, textAlign: 'center' },
            ]}
          >
            {t('loginSecurityNote')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  banner: {},
  branding: {
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 120,
  },
  actions: {},
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  securityFooter: {},
});
