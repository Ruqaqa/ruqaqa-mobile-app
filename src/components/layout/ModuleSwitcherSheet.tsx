import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wallet, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { AppModule } from '../../types/permissions';
import { withAlpha } from '../../utils/colorUtils';

const MODULE_ICONS: Record<AppModule, typeof Wallet> = {
  finance: Wallet,
  gallery: ImageIcon,
};

interface Props {
  visible: boolean;
  activeModule: AppModule;
  availableModules: AppModule[];
  onSelect: (mod: AppModule) => void;
  onClose: () => void;
}

/**
 * Modal bottom sheet for switching between Finance and Gallery modules.
 */
export function ModuleSwitcherSheet({
  visible,
  activeModule,
  availableModules,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  const labels: Record<AppModule, string> = {
    finance: t('finance'),
    gallery: t('gallery'),
  };

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

        <Text
          style={[
            typography.headingSmall,
            { color: colors.foreground, marginBottom: spacing.lg },
          ]}
        >
          {t('modules')}
        </Text>

        {availableModules.map((mod) => {
          const isActive = mod === activeModule;
          const Icon = MODULE_ICONS[mod];
          return (
            <Pressable
              key={mod}
              onPress={() => onSelect(mod)}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? withAlpha(colors.primary, 0.08) : withAlpha(colors.foregroundSecondary, 0.05),
                  borderRadius: radius.lg,
                  borderWidth: isActive ? 1.5 : 1,
                  borderColor: isActive ? withAlpha(colors.primary, 0.3) : withAlpha(colors.foregroundSecondary, 0.15),
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.base,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <View style={styles.optionLeft}>
                <Icon
                  size={32}
                  color={isActive ? colors.primary : colors.foregroundSecondary}
                />
                <Text
                  style={[
                    typography.bodyLarge,
                    {
                      color: isActive ? colors.primary : colors.foreground,
                      fontWeight: isActive ? '600' : '400',
                      marginStart: spacing.base,
                    },
                  ]}
                >
                  {labels[mod]}
                </Text>
              </View>
              {isActive && (
                <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.12), borderRadius: radius.full }]}>
                  <Text
                    style={[typography.labelSmall, { color: colors.primary }]}
                  >
                    {t('currentModule')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
