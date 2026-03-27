import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/services/authContext';
import { useTheme } from '../src/theme';

/**
 * Root index: redirects to login or main app based on auth state.
 * Shows a branded loading screen while session is being restored.
 */
export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View
        testID="splash-screen"
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Text
          style={[
            typography.headingMedium,
            { color: colors.primary, marginBottom: spacing.xxxl },
          ]}
        >
          {t('appTitle')}
        </Text>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.foregroundSecondary,
              marginTop: spacing.md,
            },
          ]}
        >
          {t('restoringSession')}
        </Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
