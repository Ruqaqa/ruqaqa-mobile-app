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
import { AutocompleteField, AutocompleteItem } from '@/components/ui/AutocompleteField';
import { ApprovalStatusChips } from '@/components/finance/ApprovalStatusChips';
import { ReconciliationFilters, EMPTY_FILTERS, RECONCILIATION_TYPES, ENTITY_TYPES } from '../types';
import { sanitizeFilters } from '../utils/sanitize';
import { getFinanceChannels, CachedFinanceChannel } from '@/services/financeChannelService';
import { getEmployees, CachedEmployee } from '@/services/employeeCacheService';

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
  const [employees, setEmployees] = useState<CachedEmployee[]>([]);
  const [selectedFromEmployee, setSelectedFromEmployee] = useState<AutocompleteItem | null>(null);
  const [selectedToEmployee, setSelectedToEmployee] = useState<AutocompleteItem | null>(null);

  useEffect(() => {
    if (visible) {
      getFinanceChannels().then(setChannels);
      getEmployees().then(setEmployees);
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

  const entityTypeOptions = useMemo(
    () =>
      ENTITY_TYPES.map((et) => ({
        label: t(
          et === 'المحفظة'
            ? 'entityTypeWallet'
            : et === 'employee'
              ? 'entityTypeEmployee'
              : ('entityTypeBiladCard' as any),
        ),
        value: et,
      })),
    [t],
  );

  // Sync local filters and derive selected employee state when modal opens
  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      // Derive selected employee from filter text + cached employees
      if (filters.fromEmployee && filters.fromType === 'employee') {
        const match = employees.find((e) => e.id === filters.fromEmployee);
        setSelectedFromEmployee(match ? { id: match.id, label: match.name } : null);
      } else {
        setSelectedFromEmployee(null);
      }
      if (filters.toEmployee && filters.toType === 'employee') {
        const match = employees.find((e) => e.id === filters.toEmployee);
        setSelectedToEmployee(match ? { id: match.id, label: match.name } : null);
      } else {
        setSelectedToEmployee(null);
      }
    }
  }, [visible, filters, employees]);

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

  const handleEmployeeSearch = useCallback(
    async (query: string): Promise<AutocompleteItem[]> => {
      const q = query.toLowerCase();
      return employees
        .filter((e) => e.name.toLowerCase().includes(q))
        .map((e) => ({ id: e.id, label: e.name }));
    },
    [employees],
  );

  const handleClear = useCallback(() => {
    setLocalFilters(EMPTY_FILTERS);
    setSelectedFromEmployee(null);
    setSelectedToEmployee(null);
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

          {/* 3. Sender section */}
          <Text
            style={[
              typography.label,
              { color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.sm },
            ]}
          >
            {t('senderDetails')}
          </Text>
          <SelectField
            label={t('senderType')}
            value={localFilters.fromType}
            placeholder={t('selectSenderType')}
            options={entityTypeOptions}
            onChange={(v) => {
              updateField('fromType', v as any);
              if (v !== 'employee') {
                updateField('fromEmployee', '');
                setSelectedFromEmployee(null);
              }
            }}
            onClear={() => {
              updateField('fromType', null);
              updateField('fromEmployee', '');
              setSelectedFromEmployee(null);
            }}
          />
          {localFilters.fromType === 'employee' && (
            <AutocompleteField
              label={t('senderEmployee')}
              value={selectedFromEmployee}
              placeholder={t('searchBySenderEmployee')}
              onSearch={handleEmployeeSearch}
              onSelect={(item) => {
                updateField('fromEmployee', item.id);
                setSelectedFromEmployee(item);
              }}
              onClear={() => {
                updateField('fromEmployee', '');
                setSelectedFromEmployee(null);
              }}
              minChars={0}
              testID="from-employee-autocomplete"
            />
          )}

          {/* 4. Receiver section */}
          <Text
            style={[
              typography.label,
              { color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.sm },
            ]}
          >
            {t('receiverDetails')}
          </Text>
          <SelectField
            label={t('receiverType')}
            value={localFilters.toType}
            placeholder={t('selectReceiverType')}
            options={entityTypeOptions}
            onChange={(v) => {
              updateField('toType', v as any);
              if (v !== 'employee') {
                updateField('toEmployee', '');
                setSelectedToEmployee(null);
              }
            }}
            onClear={() => {
              updateField('toType', null);
              updateField('toEmployee', '');
              setSelectedToEmployee(null);
            }}
          />
          {localFilters.toType === 'employee' && (
            <AutocompleteField
              label={t('receiverEmployee')}
              value={selectedToEmployee}
              placeholder={t('searchByReceiverEmployee')}
              onSearch={handleEmployeeSearch}
              onSelect={(item) => {
                updateField('toEmployee', item.id);
                setSelectedToEmployee(item);
              }}
              minChars={0}
              onClear={() => {
                updateField('toEmployee', '');
                setSelectedToEmployee(null);
              }}
              testID="to-employee-autocomplete"
            />
          )}

          {/* 5. Min Amount / Max Amount side by side (always positive for reconciliation) */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('minAmount')}
                placeholder={t('min')}
                value={localFilters.amountMin}
                onChangeText={(v) => updateField('amountMin', v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Input
                label={t('maxAmount')}
                placeholder={t('max')}
                value={localFilters.amountMax}
                onChangeText={(v) => updateField('amountMax', v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* 6. Type */}
          <SelectField
            label={t('reconciliationType')}
            value={localFilters.type}
            placeholder={t('selectReconciliationType')}
            options={typeOptions}
            onChange={(v) => updateField('type', v as any)}
            onClear={() => updateField('type', null)}
          />

          {/* 7. Sender Channel */}
          <SelectField
            label={t('senderChannel')}
            value={localFilters.senderChannel || null}
            placeholder={t('senderChannel')}
            options={channelOptions}
            onChange={(v) => updateField('senderChannel', v)}
            onClear={() => updateField('senderChannel', '')}
          />

          {/* 8. Receiver Channel */}
          <SelectField
            label={t('receiverChannel')}
            value={localFilters.receiverChannel || null}
            placeholder={t('receiverChannel')}
            options={channelOptions}
            onChange={(v) => updateField('receiverChannel', v)}
            onClear={() => updateField('receiverChannel', '')}
          />

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

          {/* 10-11. Date From / Date To */}
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
