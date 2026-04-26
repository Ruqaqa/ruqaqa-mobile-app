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
import { TransactionFilters, EMPTY_FILTERS, TAX_QUARTERS, TAX_YEARS, WALLET_PARTNER, BALAD_CARD_PARTNER } from '../types';
import { sanitizeFilters } from '../utils/sanitize';
import { ApprovalStatusChips } from './ApprovalStatusChips';
import { AmountInput } from '@/components/finance/AmountInput';
import { SelectField } from '@/components/ui/SelectField';
import { getEmployees, CachedEmployee } from '@/services/employeeCacheService';

interface SearchModalProps {
  visible: boolean;
  filters: TransactionFilters;
  showOwn: boolean;
  onApply: (filters: TransactionFilters) => void;
  onClose: () => void;
}

export function SearchModal({
  visible,
  filters,
  showOwn,
  onApply,
  onClose,
}: SearchModalProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters);
  const [minNegative, setMinNegative] = useState(false);
  const [maxNegative, setMaxNegative] = useState(false);
  const [employees, setEmployees] = useState<CachedEmployee[]>([]);

  // Load employees when modal opens
  useEffect(() => {
    if (visible) {
      getEmployees().then(setEmployees);
    }
  }, [visible]);

  const partnerOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [
      { label: t('wallet'), value: WALLET_PARTNER },
      { label: t('baladCard'), value: BALAD_CARD_PARTNER },
    ];
    for (const emp of employees) {
      if (emp.name) opts.push({ label: emp.name, value: emp.id });
    }
    return opts;
  }, [employees, t]);

  // Sync when opened; clear partner filter if viewing own transactions
  useEffect(() => {
    if (visible) {
      const synced = showOwn ? { ...filters, partnerEmployee: '' } : filters;
      setLocalFilters(synced);
      setMinNegative(synced.amountMin.startsWith('-'));
      setMaxNegative(synced.amountMax.startsWith('-'));
    }
  }, [visible, filters, showOwn]);

  const updateField = useCallback(
    <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
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
    setMinNegative(false);
    setMaxNegative(false);
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
            {t('advancedSearch')}
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

          {/* 2. Transaction Number */}
          <Input
            label={t('transactionNumber')}
            value={localFilters.transactionNumber}
            onChangeText={(v) => updateField('transactionNumber', v)}
          />

          {/* 3. Partner (employee) — hidden in "My Transactions" mode */}
          {!showOwn && (
            <SelectField
              label={t('partnerEmployee')}
              value={localFilters.partnerEmployee || null}
              placeholder={t('searchPartnerEmployee')}
              options={partnerOptions}
              onChange={(v) => updateField('partnerEmployee', v)}
              onClear={() => updateField('partnerEmployee', '')}
            />
          )}

          {/* 4. Other Party (free text) */}
          <Input
            label={t('otherParty')}
            value={localFilters.otherParty}
            onChangeText={(v) => updateField('otherParty', v)}
            placeholder={t('searchOtherParty')}
          />

          {/* 4. Client */}
          <Input
            label={t('client')}
            value={localFilters.client}
            onChangeText={(v) => updateField('client', v)}
          />

          {/* 5. Project */}
          <Input
            label={t('project')}
            value={localFilters.project}
            onChangeText={(v) => updateField('project', v)}
          />

          {/* 6. Min Amount / Max Amount side by side with +/- toggles */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <AmountInput
                label={t('minAmount')}
                placeholder={t('min')}
                value={localFilters.amountMin}
                isNegative={minNegative}
                onChangeText={(v) => updateField('amountMin', (minNegative ? '-' : '') + v.replace(/[^0-9.]/g, ''))}
                onToggleSign={() => {
                  setMinNegative((prev) => {
                    const raw = localFilters.amountMin.replace(/^-/, '');
                    updateField('amountMin', !prev && raw ? `-${raw}` : raw);
                    return !prev;
                  });
                }}
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <AmountInput
                label={t('maxAmount')}
                placeholder={t('max')}
                value={localFilters.amountMax}
                isNegative={maxNegative}
                onChangeText={(v) => updateField('amountMax', (maxNegative ? '-' : '') + v.replace(/[^0-9.]/g, ''))}
                onToggleSign={() => {
                  setMaxNegative((prev) => {
                    const raw = localFilters.amountMax.replace(/^-/, '');
                    updateField('amountMax', !prev && raw ? `-${raw}` : raw);
                    return !prev;
                  });
                }}
              />
            </View>
          </View>

          {/* 8. Tax Quarter / Year side by side */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <SelectField
                label={t('taxQuarter')}
                value={localFilters.taxQuarter}
                placeholder={t('taxQuarter')}
                options={TAX_QUARTERS.map((q) => ({
                  label: t(q.toLowerCase() as any),
                  value: q,
                }))}
                onChange={(v) => updateField('taxQuarter', v as any)}
                onClear={() => updateField('taxQuarter', null)}
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <SelectField
                label={t('taxYear')}
                value={localFilters.taxYear}
                placeholder={t('taxYear')}
                options={TAX_YEARS.map((y) => ({
                  label: y,
                  value: y,
                }))}
                onChange={(v) => updateField('taxYear', v as any)}
                onClear={() => updateField('taxYear', null)}
              />
            </View>
          </View>

          {/* 9. Approval Status */}
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

          {/* 10. From Date / To Date */}
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
