import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useAppModuleContext } from '../../navigation/AppModuleContext';
import { changeLanguage, isRTL } from '../../i18n';
import type { Language } from '../../i18n';

/**
 * Top app bar with module switcher button (left) and language + profile (right).
 */
export function AppBar() {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const { canSwitch, openSwitcher, activeModule } = useAppModuleContext();

  const currentLang = i18n.language as Language;
  const toggleLang = () =>
    changeLanguage(currentLang === 'ar' ? 'en' : 'ar');

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Left: module switcher */}
      <View style={styles.left}>
        {canSwitch && (
          <Pressable
            onPress={openSwitcher}
            style={[
              styles.iconButton,
              { backgroundColor: colors.muted, borderRadius: radius.md },
            ]}
            accessibilityLabel={t('switchModule')}
          >
            <Text style={[typography.labelSmall, { color: colors.primary }]}>
              {activeModule === 'finance' ? t('finance') : t('gallery')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Right: language toggle + profile placeholder */}
      <View style={styles.right}>
        <Pressable
          onPress={toggleLang}
          style={[
            styles.iconButton,
            { backgroundColor: colors.muted, borderRadius: radius.md },
          ]}
          accessibilityLabel="Toggle language"
        >
          <Text style={[typography.labelSmall, { color: colors.foreground }]}>
            {currentLang === 'ar' ? 'EN' : 'AR'}
          </Text>
        </Pressable>

        {/* Profile avatar placeholder */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary, borderRadius: radius.full, marginStart: spacing.sm },
          ]}
        >
          <Text style={[typography.labelSmall, { color: '#ffffff' }]}>U</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center' },
  right: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
