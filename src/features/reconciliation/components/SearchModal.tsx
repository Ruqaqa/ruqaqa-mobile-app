import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Keyboard,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { SelectField } from '@/components/ui/SelectField';
import { ApprovalStatusChips } from '@/components/finance/ApprovalStatusChips';
import { ReconciliationFilters, EMPTY_FILTERS, RECONCILIATION_TYPES } from '../types';
import { sanitizeFilters } from '../utils/sanitize';
import { getFinanceChannels, CachedFinanceChannel } from '@/services/financeChannelService';

interface SearchModalProps {
  visible: boolean;
  filters: ReconciliationFilters;
  onApply: (filters: ReconciliationFilters) => void;
  onClose: () => void;
}

export function SearchModal({
  visible,
  filters,
  onApply,
  onClose,
}: SearchModalProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();

  const [localFilters, setLocalFilters] = useState<ReconciliationFilters>(filters);
  const [channels, setChannels] = useState<CachedFinanceChannel[]>([]);

  useEffect(() => {
    if (visible) {
      getFinanceChannels().then(setChannels);
    }
  }, [visible]);

  const channelOptions = useMemo(
    () => channels.map((ch) => ({ label: ch.name, value: ch.id })),
    [channels],
  );

  const typeOptions = useMemo(
    () =>
      RECONCILIATION_TYPES.map((type) => ({
        label: t(
          type === 'salary'
            ? 'typeSalary'
            : type === 'bonus'
              ? 'typeBonus'
              : ('typeNormal' as any),
        ),
        value: type,
      })),
    [t],
  );

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  const updateField = useCallback(
    <K extends keyof ReconciliationFilters>(key: K, value: ReconciliationFilters[K]) => {
      setLocalFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    const sanitized = sanitizeFilters(localFilters);
    onApply(sanitized);
    onClose();
  }, [localFilters, onApply, onClose]);

  const handleClear = useCallback(() => {
    setLocalFilters(EMPTY_FILTERS);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
            },
          ]}
        >
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.onPrimary} />
          </Pressable>
          <Text
            style={[
              typography.headingSmall,
              { color: colors.onPrimary, textAlign: 'center', flex: 1 },
            ]}
          >
            {t('searchReconciliations')}
          </Text>
          <View style={styles.closeButton} />
        </View>

        {/* Form */}
        <ScrollView
          contentContainerStyle={{
            padding: spacing.base,
            paddingBottom: 100,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Statement */}
          <Input
            label={t('statement')}
            value={localFilters.statement}
            onChangeText={(v) => updateField('statement', v)}
            placeholder={t('searchInStatement')}
          />

          {/* 2. Reconciliation Number */}
          <Input
            label={t('reconciliationNumber')}
            value={localFilters.reconciliationNumber}
            onChangeText={(v) => updateField('reconciliationNumber', v)}
            placeholder={t('searchByReconciliationNumber')}
          />

          {/* 3. Employee */}
          <Input
            label={t('employee')}
            value={localFilters.employee}
            onChangeText={(v) => updateField('employee', v)}
            placeholder={t('searchByEmployee')}
          />

          {/* 4. Amount */}
          <Input
            label={t('totalAmount')}
            value={localFilters.amount}
            onChangeText={(v) => updateField('amount', v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />

          {/* 5. Type */}
          <SelectField
            label={t('reconciliationType')}
            value={localFilters.type}
            placeholder={t('selectReconciliationType')}
            options={typeOptions}
            onChange={(v) => updateField('type', v as any)}
            onClear={() => updateField('type', null)}
          />

          {/* 6. Sender Channel */}
          <SelectField
            label={t('senderChannel')}
            value={localFilters.senderChannel || null}
            placeholder={t('senderChannel')}
            options={channelOptions}
            onChange={(v) => updateField('senderChannel', v)}
            onClear={() => updateField('senderChannel', '')}
          />

          {/* 7. Receiver Channel */}
          <SelectField
            label={t('receiverChannel')}
            value={localFilters.receiverChannel || null}
            placeholder={t('receiverChannel')}
            options={channelOptions}
            onChange={(v) => updateField('receiverChannel', v)}
            onClear={() => updateField('receiverChannel', '')}
          />

          {/* 8. Approval Status */}
          <Text
            style={[
              typography.label,
              { color: colors.foreground, marginBottom: spacing.sm },
            ]}
          >
            {t('approvalStatus')}
          </Text>
          <ApprovalStatusChips
            value={localFilters.approvalStatus}
            onChange={(v) => updateField('approvalStatus', v)}
          />

          {/* 9-10. Date From / Date To */}
          <View style={[styles.dateRow, { marginTop: spacing.base }]}>
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('fromDate')}
                value={localFilters.dateFrom}
                onChange={(v) => updateField('dateFrom', v)}
                maxDate={localFilters.dateTo ?? undefined}
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('toDate')}
                value={localFilters.dateTo}
                onChange={(v) => updateField('dateTo', v)}
                minDate={localFilters.dateFrom ?? undefined}
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom action bar */}
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={{ flex: 1, marginEnd: spacing.sm }}>
            <Button
              title={t('clearAll')}
              onPress={handleClear}
              variant="outline"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={t('search')}
              onPress={handleSearch}
              testID="search-apply-button"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
});
