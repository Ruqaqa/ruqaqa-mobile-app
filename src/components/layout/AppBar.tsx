import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react-native';
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
      {/* Profile + language toggle (leading side: left in LTR, right in RTL) */}
      <View style={styles.section}>
        {/* Profile avatar placeholder */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary, borderRadius: radius.full, marginEnd: spacing.sm },
          ]}
        >
          <Text style={[typography.labelSmall, { color: '#ffffff' }]}>U</Text>
        </View>

        <Pressable
          onPress={toggleLang}
          style={[
            styles.iconButton,
            { backgroundColor: colors.muted, borderRadius: radius.md },
          ]}
          accessibilityLabel="Toggle language"
        >
          <Globe size={18} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Module switcher (trailing side: right in LTR, left in RTL) */}
      <View style={styles.section}>
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
  section: { flexDirection: 'row', alignItems: 'center' },
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
