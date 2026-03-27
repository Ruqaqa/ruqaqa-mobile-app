import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

/**
 * Shown when user has zero permitted modules.
 */
export function NoAccessScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.headingLarge, { color: colors.foreground, textAlign: 'center' }]}>
        {t('permissionRequired')}
      </Text>
      <Text
        style={[
          typography.bodyMedium,
          {
            color: colors.foregroundSecondary,
            textAlign: 'center',
            marginTop: spacing.md,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        You don't have access to any modules. Please contact your administrator.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
