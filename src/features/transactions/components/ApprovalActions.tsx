import React from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import { ApprovalStatus, Transaction } from '../types';

interface ApprovalActionsProps {
  currentStatus: ApprovalStatus;
  isUpdating: boolean;
  onStatusChange: (newStatus: ApprovalStatus) => void;
}

export function ApprovalActions({
  currentStatus,
  isUpdating,
  onStatusChange,
}: ApprovalActionsProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const confirmAndChange = (newStatus: ApprovalStatus) => {
    let title: string;
    let message: string;

    switch (newStatus) {
      case 'Approved':
        title = t('confirmApproval');
        message = t('areYouSureApprove');
        break;
      case 'Rejected':
        title = t('confirmRejection');
        message = t('areYouSureReject');
        break;
      case 'Pending':
        title = t('confirmReturnToPending');
        message = t('areYouSureReturnToPending');
        break;
    }

    Alert.alert(title, message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: () => onStatusChange(newStatus),
      },
    ]);
  };

  if (isUpdating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const buttons: { status: ApprovalStatus; variant: 'default' | 'destructive' | 'outline' }[] = [];

  if (currentStatus !== 'Approved') {
    buttons.push({ status: 'Approved', variant: 'default' });
  }
  if (currentStatus !== 'Rejected') {
    buttons.push({ status: 'Rejected', variant: 'destructive' });
  }
  if (currentStatus !== 'Pending') {
    buttons.push({ status: 'Pending', variant: 'outline' });
  }

  return (
    <View style={[styles.container, { gap: spacing.sm }]}>
      {buttons.map(({ status, variant }) => (
        <View key={status} style={{ flex: 1 }}>
          <Button
            title={
              status === 'Approved'
                ? t('approve')
                : status === 'Rejected'
                  ? t('reject')
                  : t('setToPending')
            }
            onPress={() => confirmAndChange(status)}
            variant={variant}
            size="md"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  loadingContainer: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
