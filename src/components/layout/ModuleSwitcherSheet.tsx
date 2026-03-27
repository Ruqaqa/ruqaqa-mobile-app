import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { AppModule } from '../../types/permissions';

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
            ...shadows.lg,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

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
          return (
            <Pressable
              key={mod}
              onPress={() => onSelect(mod)}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.primary + '15' : 'transparent',
                  borderRadius: radius.lg,
                  borderWidth: isActive ? 1 : 0,
                  borderColor: isActive ? colors.primary + '30' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  typography.bodyLarge,
                  { color: isActive ? colors.primary : colors.foreground },
                ]}
              >
                {labels[mod]}
              </Text>
              {isActive && (
                <Text
                  style={[typography.bodySmall, { color: colors.foregroundSecondary }]}
                >
                  {t('currentModule')}
                </Text>
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
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
});
