import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FileText, User, Briefcase, FolderOpen } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '@/components/ui/StatusChip';
import { SaudiRiyalSymbol } from '@/components/ui/SaudiRiyalSymbol';
import { Transaction } from '../types';
import { formatDate, formatAmount, getAmountColor, getPartnerDisplay } from '../utils/formatters';

interface TransactionCardProps {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
}

export const TransactionCard = React.memo(function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const handlePress = React.useCallback(() => onPress(transaction), [onPress, transaction]);
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const amountColorKey = getAmountColor(transaction.totalAmount);
  const partner = getPartnerDisplay({
    partnerType: transaction.partnerType,
    partnerEmployee: transaction.partnerEmployee,
  });
  const hasReceipts =
    transaction.expenseReceipts && transaction.expenseReceipts.length > 0;
  const hasTaxOrFees = transaction.tax || transaction.bankFees;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.sm,
          marginVertical: spacing.xs,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      testID={`transaction-card-${transaction.id}`}
    >
      {/* Row 1: Statement + Status */}
      <View style={styles.row}>
        <Text
          style={[
            typography.headingSmall,
            { color: colors.foreground, flex: 1 },
          ]}
          numberOfLines={2}
        >
          {transaction.statement}
        </Text>
        <StatusChip
          status={
            transaction.approvalStatus.toLowerCase() as 'pending' | 'approved' | 'rejected'
          }
        />
      </View>

      {/* Row 2: Amount + Currency */}
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Text
          style={[
            typography.headingMedium,
            { color: colors[amountColorKey] },
          ]}
        >
          {formatAmount(transaction.totalAmount)}
        </Text>
        <View
          style={[
            styles.currencyBadge,
            {
              marginStart: 4,
            },
          ]}
        >
          {transaction.currency === 'SAR' || transaction.currency === 'ريال سعودي' ? (
            <SaudiRiyalSymbol size={14} color={colors[amountColorKey]} />
          ) : (
            <Text style={[typography.labelSmall, { color: colors.foregroundSecondary }]}>
              {transaction.currency}
            </Text>
          )}
        </View>
      </View>

      {/* Row 3: Tax + Bank fees (conditional) */}
      {hasTaxOrFees && (
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
            {transaction.tax ? `${t('tax')}: ${transaction.tax}` : ''}
            {transaction.tax && transaction.bankFees ? ' \u00B7 ' : ''}
            {transaction.bankFees
              ? `${t('bankFees')}: ${formatAmount(transaction.bankFees)}`
              : ''}
          </Text>
        </View>
      )}

      {/* Row 4: Metadata lines */}
      <View style={{ marginTop: spacing.sm }}>
        {transaction.client && (
          <MetadataLine
            icon={<Briefcase size={12} color={colors.foregroundSecondary} />}
            label={t('client')}
            value={transaction.client.name}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
        )}
        {transaction.project && (
          <MetadataLine
            icon={<FolderOpen size={12} color={colors.foregroundSecondary} />}
            label={t('project')}
            value={transaction.project.name}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
        )}
        {partner && (
          <MetadataLine
            icon={<User size={12} color={colors.foregroundSecondary} />}
            label={t('partner')}
            value={partner}
            colors={colors}
            typography={typography}
            spacing={spacing}
          />
        )}
      </View>

      {/* Row 5: Footer */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            { color: colors.foregroundSecondary, fontWeight: '700' },
          ]}
        >
          {transaction.transactionNumber ?? ''}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.foregroundSecondary }]}>
          {formatDate(transaction.transactionDate ?? transaction.createdAt)}
        </Text>
        {hasReceipts && (
          <FileText size={14} color={colors.secondary} />
        )}
      </View>
    </Pressable>
  );
});

function MetadataLine({
  icon,
  label,
  value,
  colors,
  typography,
  spacing,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: any;
  typography: any;
  spacing: any;
}) {
  return (
    <View style={[styles.metadataRow, { marginBottom: spacing.xxs }]}>
      {icon}
      <Text
        style={[
          typography.bodyMedium,
          { color: colors.foregroundSecondary, marginStart: spacing.xs },
        ]}
      >
        {label}:
      </Text>
      <Text
        style={[
          typography.bodyMedium,
          { color: colors.foreground, marginStart: spacing.xs, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyBadge: {},
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
});
