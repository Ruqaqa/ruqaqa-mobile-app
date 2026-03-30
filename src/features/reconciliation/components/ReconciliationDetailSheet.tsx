import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { StatusChip } from '@/components/ui/StatusChip';
import { ApprovalActions } from '@/components/finance/ApprovalActions';
import { DetailRow } from '@/components/finance/DetailRow';
import { Reconciliation, ApprovalStatus } from '../types';
import { formatDate, formatAmount, getPartyDisplay, getChannelDisplay, getTypeBadgeConfig } from '../utils/formatters';
import { ReconciliationFlowWidget } from './ReconciliationFlowWidget';

interface ReconciliationDetailSheetProps {
  reconciliation: Reconciliation | null;
  visible: boolean;
  onClose: () => void;
  canUpdate: boolean;
  isUpdating: boolean;
  onStatusChange: (newStatus: ApprovalStatus) => void;
}

const SHEET_HEIGHT_RATIO = 0.75;

export function ReconciliationDetailSheet({
  reconciliation,
  visible,
  onClose,
  canUpdate,
  isUpdating,
  onStatusChange,
}: ReconciliationDetailSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible || !reconciliation) return null;

  const typeBadge = getTypeBadgeConfig(reconciliation.type);
  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <View />
      </Pressable>

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            height: screenHeight * SHEET_HEIGHT_RATIO,
            backgroundColor: colors.surface,
            borderTopStartRadius: radius.lg,
            borderTopEndRadius: radius.lg,
          },
        ]}
      >
        {/* Handle indicator */}
        <View style={styles.handleRow}>
          <View
            style={[
              styles.handle,
              { backgroundColor: colors.border },
            ]}
          />
        </View>

        {/* Close button */}
        <View
          style={[
            styles.closeRow,
            { paddingHorizontal: spacing.base },
          ]}
        >
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.foregroundSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.base, paddingBottom: 40 }}
        >
          {/* Title */}
          <Text
            style={[
              typography.headingLarge,
              { color: colors.primary, marginBottom: spacing.lg },
            ]}
          >
            {t('reconciliationDetails')}
          </Text>

          {/* Detail rows */}
          <DetailRow
            label={t('reconciliationNumber')}
            value={reconciliation.reconciliationNumber}
          />
          <DetailRow
            label={t('statement')}
            value={reconciliation.statement}
          />

          {/* Type badge */}
          <View style={[styles.detailRow, { marginBottom: spacing.md }]}>
            <Text
              style={[
                typography.label,
                styles.detailLabel,
                { color: colors.foregroundSecondary },
              ]}
            >
              {t('reconciliationType')}
            </Text>
            <View
              style={{
                backgroundColor: withAlpha(typeBadge.color, 0.12),
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: typeBadge.color, fontWeight: '600', fontSize: 12 }}>
                {t(typeBadge.label as any)}
              </Text>
            </View>
          </View>

          {/* Status */}
          <View style={[styles.detailRow, { marginBottom: spacing.md }]}>
            <Text
              style={[
                typography.label,
                styles.detailLabel,
                { color: colors.foregroundSecondary },
              ]}
            >
              {t('status')}
            </Text>
            <StatusChip
              status={
                reconciliation.approvalStatus.toLowerCase() as 'pending' | 'approved' | 'rejected'
              }
            />
          </View>

          <DetailRow
            label={t('totalAmount')}
            value={formatAmount(reconciliation.totalAmount, reconciliation.currency)}
          />

          {reconciliation.bankFees !== null && reconciliation.bankFees > 0 && (
            <DetailRow
              label={t('bankFees')}
              value={formatAmount(
                reconciliation.bankFees,
                reconciliation.bankFeesCurrency ?? reconciliation.currency,
              )}
            />
          )}

          <DetailRow
            label={t('date')}
            value={formatDate(reconciliation.date ?? reconciliation.createdAt)}
          />

          <DetailRow
            label={t('from')}
            value={getPartyDisplay(reconciliation.fromType, reconciliation.fromEmployee)}
          />
          <DetailRow
            label={t('senderChannel')}
            value={getChannelDisplay(reconciliation.senderChannel)}
          />
          <DetailRow
            label={t('to')}
            value={getPartyDisplay(reconciliation.toType, reconciliation.toEmployee)}
          />
          <DetailRow
            label={t('receiverChannel')}
            value={getChannelDisplay(reconciliation.receiverChannel)}
          />

          {/* Flow widget */}
          <View style={{ marginTop: spacing.base }}>
            <ReconciliationFlowWidget
              fromType={reconciliation.fromType}
              fromEmployee={reconciliation.fromEmployee}
              senderChannel={reconciliation.senderChannel}
              toType={reconciliation.toType}
              toEmployee={reconciliation.toEmployee}
              receiverChannel={reconciliation.receiverChannel}
            />
          </View>

          {/* Notes */}
          {reconciliation.notes && (
            <View
              style={[
                styles.notesStrip,
                {
                  backgroundColor: colors.muted,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginTop: spacing.base,
                },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.foreground }]}>
                {reconciliation.notes}
              </Text>
            </View>
          )}

          {/* Approval actions */}
          {canUpdate && (
            <View style={{ marginTop: spacing.lg }}>
              <ApprovalActions
                currentStatus={reconciliation.approvalStatus}
                isUpdating={isUpdating}
                onStatusChange={onStatusChange}
              />
            </View>
          )}
        </ScrollView>
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
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    width: 100,
    fontWeight: '500',
  },
  notesStrip: {},
});
