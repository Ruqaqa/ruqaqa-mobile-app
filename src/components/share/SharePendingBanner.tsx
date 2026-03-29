import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { Paperclip, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';

interface SharePendingBannerProps {
  fileCount: number;
  onDismiss: () => void;
}

export function SharePendingBanner({
  fileCount,
  onDismiss,
}: SharePendingBannerProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 25,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  if (fileCount <= 0) return null;

  const messageKey = fileCount === 1
    ? 'filesReceivedBanner_one'
    : 'filesReceivedBanner_other';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.green, 0.1),
          borderRadius: radius.md,
          marginHorizontal: spacing.xl,
          padding: spacing.md,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="alert"
      testID="share-pending-banner"
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: withAlpha(colors.green, 0.15),
              borderRadius: radius.full,
            },
          ]}
        >
          <Paperclip size={16} color={colors.green} />
        </View>
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.green,
              flex: 1,
              marginStart: spacing.sm,
            },
          ]}
        >
          {t(messageKey, { count: fileCount })}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={({ pressed }) => [
            styles.dismissButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel={t('cancel')}
          testID="share-pending-dismiss"
        >
          <X size={16} color={colors.green} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
