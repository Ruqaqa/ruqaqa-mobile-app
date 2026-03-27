import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { withAlpha } from '../../utils/colorUtils';
import { Button } from '../ui/Button';

interface SessionExpiredModalProps {
  visible: boolean;
  onSignIn: () => void;
}

export function SessionExpiredModal({
  visible,
  onSignIn,
}: SessionExpiredModalProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[styles.backdrop, { padding: spacing.xl }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              ...shadows.xl,
            },
          ]}
        >
          {/* Icon circle */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: withAlpha(colors.error, 0.1),
                borderRadius: radius.full,
              },
            ]}
          >
            <Lock size={48} color={colors.error} />
          </View>

          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="assertive"
            style={[
              typography.headingLarge,
              {
                color: colors.foreground,
                textAlign: 'center',
                marginTop: spacing.lg,
              },
            ]}
          >
            {t('sessionExpired')}
          </Text>

          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.foregroundSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            {t('sessionExpiredMessage')}
          </Text>

          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <Button
              testID="session-expired-sign-in"
              title={t('signIn')}
              onPress={onSignIn}
              variant="default"
              size="lg"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
