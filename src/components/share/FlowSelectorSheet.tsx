import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  Receipt,
  Scale,
  ImageIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { SharedFile, SharedFilesPreview } from './SharedFilesPreview';

export type ShareFlowTarget = 'transaction' | 'reconciliation' | 'gallery';

interface FlowSelectorSheetProps {
  visible: boolean;
  files: SharedFile[];
  onSelect: (target: ShareFlowTarget) => void;
  onDismiss: () => void;
  onRemoveFile?: (index: number) => void;
}

interface FlowOption {
  target: ShareFlowTarget;
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  enabled: boolean;
}

export function FlowSelectorSheet({
  visible,
  files,
  onSelect,
  onDismiss,
  onRemoveFile,
}: FlowSelectorSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  const options: FlowOption[] = [
    {
      target: 'transaction',
      icon: <Receipt size={22} color={colors.green} />,
      titleKey: 'shareFlowTransaction',
      descriptionKey: 'shareFlowTransactionDesc',
      enabled: true,
    },
    {
      target: 'reconciliation',
      icon: <Scale size={22} color={colors.foregroundSecondary} />,
      titleKey: 'shareFlowReconciliation',
      descriptionKey: 'shareFlowReconciliationDesc',
      enabled: false,
    },
    {
      target: 'gallery',
      icon: <ImageIcon size={22} color={colors.foregroundSecondary} />,
      titleKey: 'shareFlowGallery',
      descriptionKey: 'shareFlowGalleryDesc',
      enabled: false,
    },
  ];

  const fileCountKey = files.length === 1
    ? 'shareFileCount_one'
    : 'shareFileCount_other';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View />
      </Pressable>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.xl,
            borderTopEndRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxxl,
            ...shadows.lg,
          },
        ]}
      >
        {/* Handle */}
        <View
          style={[
            styles.handle,
            { backgroundColor: colors.border, marginBottom: spacing.lg },
          ]}
        />

        {/* Title */}
        <Text
          style={[
            typography.headingSmall,
            { color: colors.foreground, marginBottom: spacing.xs },
          ]}
        >
          {t('shareFlowTitle')}
        </Text>

        {/* File count */}
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.foregroundSecondary,
              marginBottom: spacing.base,
            },
          ]}
        >
          {t(fileCountKey, { count: files.length })}
        </Text>

        {/* File previews */}
        {files.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <SharedFilesPreview
              files={files}
              onRemove={onRemoveFile}
            />
          </View>
        )}

        {/* Flow options */}
        {options.map((option) => (
          <Pressable
            key={option.target}
            onPress={() => option.enabled && onSelect(option.target)}
            disabled={!option.enabled}
            style={({ pressed }) => [
              styles.optionRow,
              {
                backgroundColor: pressed && option.enabled
                  ? withAlpha(colors.primary, 0.06)
                  : 'transparent',
                borderRadius: radius.lg,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.md,
                marginBottom: spacing.xs,
                opacity: option.enabled ? 1 : 0.45,
              },
            ]}
            accessibilityLabel={t(option.titleKey)}
            accessibilityState={{ disabled: !option.enabled }}
            testID={`share-flow-${option.target}`}
          >
            {/* Icon circle */}
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: option.enabled
                    ? withAlpha(colors.green, 0.1)
                    : colors.muted,
                  borderRadius: radius.full,
                },
              ]}
            >
              {option.icon}
            </View>

            {/* Text content */}
            <View style={[styles.optionText, { marginStart: spacing.md }]}>
              <View style={styles.optionTitleRow}>
                <Text
                  style={[
                    typography.label,
                    {
                      color: option.enabled
                        ? colors.foreground
                        : colors.foregroundSecondary,
                    },
                  ]}
                >
                  {t(option.titleKey)}
                </Text>
                {!option.enabled && (
                  <View
                    style={[
                      styles.comingSoonBadge,
                      {
                        backgroundColor: colors.muted,
                        borderRadius: radius.full,
                        marginStart: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xxs,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: colors.foregroundSecondary },
                      ]}
                    >
                      {t('shareFlowComingSoon')}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  typography.bodySmall,
                  {
                    color: colors.foregroundSecondary,
                    marginTop: spacing.xxs,
                  },
                ]}
              >
                {t(option.descriptionKey)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoonBadge: {},
});
