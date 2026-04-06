import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import type { Employee } from '../../types/permissions';

interface ProfileMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSignOut: () => void;
  isSigningOut: boolean;
}

export function ProfileMenuSheet({
  visible,
  onClose,
  employee,
  onSignOut,
  isSigningOut,
}: ProfileMenuSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxxl,
            ...shadows.lg,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border, marginBottom: spacing.lg }]} />

        {employee && (
          <>
            <View style={[styles.profileRow, { marginBottom: spacing.lg }]}>
              <ProfileAvatar url={employee.avatarUrl} name={employee.name} size={56} />
              <View style={{ marginStart: spacing.base, flex: 1 }}>
                <Text style={[typography.headingSmall, { color: colors.foreground }]}>
                  {t('greeting', { name: employee.name })}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border, marginBottom: spacing.lg }]} />
          </>
        )}

        <Pressable
          onPress={onSignOut}
          disabled={isSigningOut}
          style={[
            styles.signOutRow,
            {
              borderRadius: radius.lg,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.base,
              opacity: isSigningOut ? 0.6 : 1,
            },
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator size={20} color={colors.error} />
          ) : (
            <LogOut size={20} color={colors.error} />
          )}
          <Text
            style={[
              typography.bodyLarge,
              { color: colors.error, fontWeight: '500', marginStart: spacing.md },
            ]}
          >
            {t('logout')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
