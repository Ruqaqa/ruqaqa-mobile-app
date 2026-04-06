import React, { useContext, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe, Wallet, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useAppModuleContext } from '../../navigation/AppModuleContext';
import { AuthContext } from '../../services/authContext';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { ProfileMenuSheet } from './ProfileMenuSheet';
import { changeLanguage } from '../../i18n';
import type { Language } from '../../i18n';

/**
 * Top app bar with module switcher button (left) and language + profile (right).
 */
export function AppBar() {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const { canSwitch, openSwitcher, activeModule } = useAppModuleContext();
  const { employee, logout } = useContext(AuthContext);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const currentLang = i18n.language as Language;
  const toggleLang = () =>
    changeLanguage(currentLang === 'ar' ? 'en' : 'ar');

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setProfileMenuVisible(false);
    await logout();
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Profile + language toggle (leading side: left in LTR, right in RTL) */}
      <View style={styles.section}>
        <Pressable
          onPress={() => setProfileMenuVisible(true)}
          style={{ marginEnd: spacing.sm }}
          accessibilityLabel="Profile menu"
        >
          <ProfileAvatar url={employee?.avatarUrl} name={employee?.name} size={32} />
        </Pressable>

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
              styles.switcherButton,
              { backgroundColor: colors.muted, borderRadius: radius.md },
            ]}
            accessibilityLabel={t('switchModule')}
          >
            {activeModule === 'finance' ? (
              <Wallet size={16} color={colors.primary} />
            ) : (
              <ImageIcon size={16} color={colors.primary} />
            )}
            <Text style={[typography.labelSmall, { color: colors.primary, marginStart: 6 }]}>
              {activeModule === 'finance' ? t('finance') : t('gallery')}
            </Text>
          </Pressable>
        )}
      </View>

      <ProfileMenuSheet
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
        employee={employee}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
      />
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
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
});
