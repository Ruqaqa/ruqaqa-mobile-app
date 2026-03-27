import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { changeLanguage, type Language } from '../../i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  const currentLang = i18n.language as Language;
  const targetLang: Language = currentLang === 'ar' ? 'en' : 'ar';
  const label = currentLang === 'ar' ? 'EN' : 'ع';

  return (
    <Pressable
      testID="language-switcher"
      onPress={() => changeLanguage(targetLang)}
      accessibilityRole="button"
      accessibilityLabel={
        currentLang === 'ar' ? t('switchToEnglish') : t('switchToArabic')
      }
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          minHeight: 44,
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
          ...shadows.sm,
        },
      ]}
    >
      <Text
        style={[
          typography.bodyMedium,
          { color: colors.foreground, fontWeight: '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-end',
  },
});
