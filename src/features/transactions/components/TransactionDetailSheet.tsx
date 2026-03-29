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
import { X, Paperclip, Pencil } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { StatusChip } from '@/components/ui/StatusChip';
import { SaudiRiyalSymbol } from '@/components/ui/SaudiRiyalSymbol';
import { Transaction, ApprovalStatus } from '../types';
import {
  formatDate,
  formatAmount,
  getAmountColor,
  getPartnerDisplay,
  getEmployeeDisplay,
} from '../utils/formatters';
import { TransactionFlowWidget } from './TransactionFlowWidget';
import { ReceiptThumbnails } from './ReceiptThumbnails';
import { ApprovalActions } from './ApprovalActions';

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  visible: boolean;
  onClose: () => void;
  canUpdate: boolean;
  isUpdating: boolean;
  onStatusChange: (newStatus: ApprovalStatus) => void;
  /** Whether current user can add receipts (partner employee) */
  canAddReceipts?: boolean;
  /** Whether current user can fully edit receipts (accountant) */
  canEditReceipts?: boolean;
  /** Called to open the receipt editor */
  onEditReceipts?: (mode: 'add' | 'edit') => void;
}

const SHEET_HEIGHT_RATIO = 0.75;

export function TransactionDetailSheet({
  transaction,
  visible,
  onClose,
  canUpdate,
  isUpdating,
  onStatusChange,
  canAddReceipts,
  canEditReceipts,
  onEditReceipts,
}: TransactionDetailSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible || !transaction) return null;

  const amountColorKey = getAmountColor(transaction.totalAmount);
  const partner = getPartnerDisplay({
    partnerType: transaction.partnerType,
    partnerEmployee: transaction.partnerEmployee,
  });
  const recordedBy = getEmployeeDisplay(transaction.recordedBy);
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
            {t('transactionDetails')}
          </Text>

          {/* Detail rows */}
          <DetailRow
            label={t('statement')}
            value={transaction.statement}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
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
                transaction.approvalStatus.toLowerCase() as 'pending' | 'approved' | 'rejected'
              }
            />
          </View>
          <DetailRow
            label={t('totalAmount')}
            value={formatAmount(transaction.totalAmount)}
            valueColor={colors[amountColorKey]}
            colors={colors}
            typography={typography}
            spacing={spacing}
            currencySymbol={
              transaction.currency === 'SAR' || transaction.currency === 'ريال سعودي' ? (
                <SaudiRiyalSymbol size={14} color={colors[amountColorKey]} />
              ) : (
                <Text style={[typography.headingSmall, { color: colors[amountColorKey] }]}>$</Text>
              )
            }
          />
          {transaction.tax && (
            <DetailRow
              label={t('tax')}
              value={transaction.tax}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}
          {transaction.bankFees !== undefined && transaction.bankFees !== null && (
            <DetailRow
              label={t('bankFees')}
              value={formatAmount(transaction.bankFees)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}
          {transaction.transactionNumber && (
            <DetailRow
              label={t('transactionNumber')}
              value={transaction.transactionNumber}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}
          {transaction.client && (
            <DetailRow
              label={t('client')}
              value={transaction.client.name}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}
          {transaction.project && (
            <DetailRow
              label={t('project')}
              value={transaction.project.name}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}
          <DetailRow
            label={t('date')}
            value={formatDate(transaction.transactionDate ?? transaction.createdAt)}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
          {recordedBy && (
            <DetailRow
              label={t('recordedBy')}
              value={recordedBy}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          )}

          {/* Transaction flow */}
          {(partner || transaction.otherParty) && (
            <View style={{ marginTop: spacing.base }}>
              <TransactionFlowWidget
                partnerLabel={partner}
                otherPartyLabel={transaction.otherParty ?? null}
                isExpense={(transaction.totalAmount ?? 0) < 0}
              />
            </View>
          )}

          {/* Receipt thumbnails */}
          {transaction.expenseReceipts && transaction.expenseReceipts.length > 0 && (
            <View style={{ marginTop: spacing.base }}>
              <Text
                style={[
                  typography.label,
                  { color: colors.foreground, marginBottom: spacing.sm },
                ]}
              >
                {t('receipts')}
              </Text>
              <ReceiptThumbnails receipts={transaction.expenseReceipts} />
            </View>
          )}

          {/* Receipt editor buttons */}
          {onEditReceipts && (canAddReceipts || canEditReceipts) && (
            <View style={[styles.receiptActions, { marginTop: spacing.md, gap: spacing.sm }]}>
              {canEditReceipts ? (
                <Pressable
                  onPress={() => onEditReceipts('edit')}
                  style={({ pressed }) => [
                    styles.receiptActionBtn,
                    {
                      backgroundColor: withAlpha(colors.primary, 0.1),
                      borderRadius: radius.md,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel={t('editReceipts')}
                  testID="edit-receipts-btn"
                >
                  <Pencil size={18} color={colors.primary} />
                  <Text
                    style={[
                      typography.label,
                      { color: colors.primary, marginStart: spacing.sm },
                    ]}
                  >
                    {t('editReceipts')}
                  </Text>
                </Pressable>
              ) : canAddReceipts ? (
                <Pressable
                  onPress={() => onEditReceipts('add')}
                  style={({ pressed }) => [
                    styles.receiptActionBtn,
                    {
                      backgroundColor: withAlpha(colors.green, 0.1),
                      borderRadius: radius.md,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel={t('addReceipts')}
                  testID="add-receipts-btn"
                >
                  <Paperclip size={18} color={colors.green} />
                  <Text
                    style={[
                      typography.label,
                      { color: colors.green, marginStart: spacing.sm },
                    ]}
                  >
                    {t('addReceipts')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Notes */}
          {transaction.notes && (
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
                {transaction.notes}
              </Text>
            </View>
          )}

          {/* Approval actions */}
          {canUpdate && (
            <View style={{ marginTop: spacing.lg }}>
              <ApprovalActions
                currentStatus={transaction.approvalStatus}
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

function DetailRow({
  label,
  value,
  valueColor,
  colors,
  typography,
  spacing,
  currencySymbol,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: any;
  typography: any;
  spacing: any;
  currencySymbol?: React.ReactNode;
}) {
  return (
    <View style={[styles.detailRow, { marginBottom: spacing.md }]}>
      <Text
        style={[
          typography.label,
          styles.detailLabel,
          { color: colors.foregroundSecondary },
        ]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Text
          style={[
            typography.bodyMedium,
            {
              color: valueColor ?? colors.foreground,
              fontWeight: '600',
            },
          ]}
        >
          {value}
        </Text>
        {currencySymbol && <View style={{ marginStart: 4 }}>{currencySymbol}</View>}
      </View>
    </View>
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
  receiptActions: {
    flexDirection: 'row',
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    flex: 1,
    justifyContent: 'center',
  },
});
