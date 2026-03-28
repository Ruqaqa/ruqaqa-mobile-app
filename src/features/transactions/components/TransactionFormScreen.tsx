import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ChevronLeft,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { withAlpha } from '@/utils/colorUtils';
import { UserPermissions, Employee } from '@/types/permissions';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { AutocompleteField, AutocompleteItem } from '@/components/ui/AutocompleteField';
import { Button } from '@/components/ui/Button';
import {
  fetchClientSuggestions,
  fetchProjectSuggestions,
  fetchOtherPartySuggestions,
} from '../services/suggestionsService';
import { WALLET_PARTNER, BALAD_CARD_PARTNER } from '../types';
import { CachedEmployee } from '@/services/employeeCacheService';
import { ReceiptPickerSection } from './ReceiptPickerSection';
import { SubmissionPreviewDialog } from './SubmissionPreviewDialog';
import { useTransactionForm } from '../hooks/useTransactionForm';

interface TransactionFormScreenProps {
  permissions: UserPermissions;
  employee: Employee | null;
  onClose: () => void;
}

// Adapters: map server shape { id, name } to AutocompleteItem { id, label }
function toAutocompleteItems(items: { id: string; name: string }[]): AutocompleteItem[] {
  return items.map((i) => ({ id: i.id, label: i.name }));
}

interface OtherPartyItem extends AutocompleteItem {
  type: string;
  hasRealId: boolean;
}

const TAX_OPTIONS = [
  { label: 'نعم', value: 'نعم' },
  { label: 'لا', value: 'لا' },
];

const CURRENCY_OPTIONS = [
  { label: 'ريال سعودي', value: 'ريال سعودي' },
  { label: 'دولار أمريكي', value: 'دولار أمريكي' },
];

export function TransactionFormScreen({
  permissions,
  employee,
  onClose,
}: TransactionFormScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const [previewVisible, setPreviewVisible] = useState(false);

  const {
    form,
    updateField,
    getErrors,
    isValid,
    isSubmitting,
    wasSubmitted,
    canSelectPartner,
    employees,
    addAttachment,
    removeAttachment,
    canAddMore,
    maxAttachments,
    getActualAmount,
    buildPreviewPayload,
    submit,
  } = useTransactionForm({
    permissions,
    employee,
    onSuccess: onClose,
  });

  const errors = getErrors();

  // Partner options: wallet + balad card + employees
  const partnerOptions = useMemo(() => {
    const opts = [
      { label: t('wallet'), value: '__wallet__' },
      { label: t('baladCard'), value: '__baladcard__' },
    ];
    for (const emp of employees) {
      if (emp.name) {
        opts.push({ label: emp.name, value: emp.id });
      }
    }
    return opts;
  }, [employees, t]);

  const partnerValue = useMemo(() => {
    if (!form.partner) return null;
    if (form.partner === WALLET_PARTNER) return '__wallet__';
    if (form.partner === BALAD_CARD_PARTNER) return '__baladcard__';
    return form.partnerId;
  }, [form.partner, form.partnerId]);

  const handlePartnerChange = useCallback(
    (value: string) => {
      if (value === '__wallet__') {
        updateField('partner', WALLET_PARTNER);
        updateField('partnerId', null);
      } else if (value === '__baladcard__') {
        updateField('partner', BALAD_CARD_PARTNER);
        updateField('partnerId', null);
      } else {
        const emp = employees.find((e) => e.id === value);
        updateField('partner', emp?.name ?? value);
        updateField('partnerId', value);
      }
    },
    [employees, updateField],
  );

  // Other party: autocomplete that also allows free text
  // API returns items with optional id (previous free-text entries have no id)
  const handleOtherPartySearch = useCallback(async (query: string): Promise<OtherPartyItem[]> => {
    const results = await fetchOtherPartySuggestions(query);
    return results.map((i, index) => ({
      id: i.id || `prev_${index}_${i.name}`,
      label: i.name,
      type: i.type,
      hasRealId: !!i.id,
    }));
  }, []);

  const handleOtherPartySelect = useCallback(
    (item: OtherPartyItem) => {
      updateField('otherParty', item.label);
      updateField('otherPartyId', item.hasRealId ? item.id : null);
      updateField('otherPartyType', item.type);
    },
    [updateField],
  );

  const handleOtherPartyClear = useCallback(() => {
    updateField('otherParty', '');
    updateField('otherPartyId', null);
    updateField('otherPartyType', null);
  }, [updateField]);

  // Client/Project autocomplete
  const handleClientSearch = useCallback(async (query: string) => {
    const results = await fetchClientSuggestions(query);
    return toAutocompleteItems(results);
  }, []);

  const handleProjectSearch = useCallback(async (query: string) => {
    const results = await fetchProjectSuggestions(query);
    return toAutocompleteItems(results);
  }, []);

  // Receipt picker handlers
  const handlePickCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('permissionRequired'), t('pleaseAllowAccess', { permissionName: t('camera') }));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      addAttachment(
        asset.uri,
        'image',
        asset.fileName ?? `photo_${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
        asset.fileSize ?? undefined,
      );
    }
  }, [addAttachment, t]);

  const handlePickGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: maxAttachments - form.attachments.length,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        addAttachment(
          asset.uri,
          'image',
          asset.fileName ?? `image_${Date.now()}.jpg`,
          asset.mimeType ?? 'image/jpeg',
          asset.fileSize ?? undefined,
        );
      }
    }
  }, [addAttachment, maxAttachments, form.attachments.length]);

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      multiple: true,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        addAttachment(
          asset.uri,
          'document',
          asset.name,
          asset.mimeType ?? 'application/pdf',
          asset.size ?? undefined,
        );
      }
    }
  }, [addAttachment]);

  // Submit flow
  const handleSubmitPress = useCallback(() => {
    if (!isValid) {
      // Trigger validation display
      submit();
      return;
    }
    setPreviewVisible(true);
  }, [isValid, submit]);

  const handleConfirmSubmit = useCallback(async () => {
    setPreviewVisible(false);
    const result = await submit();
    if (result.success) {
      const msg = result.transactionNumber
        ? `${t('transactionSubmittedSuccess')}\n${t('transactionNumberLabel', { number: result.transactionNumber })}`
        : t('transactionSubmittedSuccess');
      Alert.alert('', msg);
    } else if (result.error) {
      Alert.alert(t('error'), result.error);
    }
  }, [submit, t]);

  const handleCancelPreview = useCallback(() => {
    setPreviewVisible(false);
  }, []);

  // Build preview fields for the dialog
  const previewFields = useMemo(() => {
    const data = buildPreviewPayload();
    return [
      { label: t('statement'), value: data['البيان'] },
      { label: t('tax'), value: data['الضريبة'] === 'نعم' ? t('yes') : t('no'), highlight: 'error' as const },
      { label: t('currency'), value: data['العملة'] },
      ...(data['رسوم بنكية'] != null && data['رسوم بنكية'] !== 0
        ? [{ label: t('bankFees'), value: `${data['رسوم بنكية']} ${data['عملة الرسوم'] ?? ''}`, highlight: 'warning' as const }]
        : []),
      { label: t('date'), value: data['التاريخ'] },
      { label: t('project'), value: data['رمز المشروع'] },
      { label: t('clientName'), value: data['اسم العميل'] },
      { label: t('partner'), value: data['طرف الشريك'] },
      { label: t('otherParty'), value: data['الطرف الآخر'] },
      ...(data['ملاحظات'] ? [{ label: t('notes'), value: data['ملاحظات'] }] : []),
    ];
  }, [buildPreviewPayload, t]);

  // Amount indicator
  const amountIndicator = form.amount && !isNaN(Number(form.amount)) && Number(form.amount) > 0
    ? (
      <Text
        style={[
          typography.label,
          {
            color: form.isExpense ? colors.error : colors.success,
            fontWeight: '600',
            marginTop: spacing.xs,
          },
        ]}
      >
        {form.isExpense ? t('expenses') : t('revenues')}
      </Text>
    )
    : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[typography.headingSmall, { color: colors.foreground, flex: 1, textAlign: 'center' }]}>
          {t('newTransaction')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* === SECTION 1: Basic Info === */}
          <SectionTitle title={t('basicInfo')} />

          <Input
            label={`${t('statement')} *`}
            value={form.statement}
            onChangeText={(text) => updateField('statement', text)}
            error={errors.statement}
            placeholder={t('statement')}
            returnKeyType="next"
          />

          <View style={styles.amountRow}>
            <View style={styles.amountInput}>
              <Input
                label={`${t('totalAmount')} *`}
                value={form.amount}
                onChangeText={(text) => {
                  // Only allow numbers and decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  updateField('amount', cleaned);
                }}
                error={errors.amount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
            <View style={[styles.toggleGroup, { marginTop: spacing.lg }]}>
              <Pressable
                onPress={() => updateField('isExpense', true)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: form.isExpense ? withAlpha(colors.error, 0.15) : colors.muted,
                    borderColor: form.isExpense ? colors.error : colors.border,
                    borderTopStartRadius: radius.md,
                    borderBottomStartRadius: radius.md,
                  },
                ]}
              >
                <Minus size={20} color={form.isExpense ? colors.error : colors.foregroundSecondary} />
              </Pressable>
              <Pressable
                onPress={() => updateField('isExpense', false)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: !form.isExpense ? withAlpha(colors.success, 0.15) : colors.muted,
                    borderColor: !form.isExpense ? colors.success : colors.border,
                    borderTopEndRadius: radius.md,
                    borderBottomEndRadius: radius.md,
                  },
                ]}
              >
                <Plus size={20} color={!form.isExpense ? colors.success : colors.foregroundSecondary} />
              </Pressable>
            </View>
          </View>
          {amountIndicator}

          {/* === SECTION 2: Tax & Currency === */}
          <SectionTitle title={t('taxAndCurrency')} />

          <SelectField
            label={t('tax')}
            value={form.tax}
            options={TAX_OPTIONS}
            onChange={(val) => updateField('tax', val)}
          />

          <SelectField
            label={t('currency')}
            value={form.currency}
            options={CURRENCY_OPTIONS}
            onChange={(val) => updateField('currency', val)}
          />

          <Input
            label={`${t('bankFees')} *`}
            value={form.bankFees}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.]/g, '');
              updateField('bankFees', cleaned);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={errors.bankFees}
          />

          <SelectField
            label={t('feesCurrency')}
            value={form.bankFeesCurrency}
            options={CURRENCY_OPTIONS}
            onChange={(val) => updateField('bankFeesCurrency', val)}
          />

          {/* === SECTION 3: Project Details === */}
          <SectionTitle title={t('projectDetails')} />

          <View style={{ zIndex: 3 }}>
            <AutocompleteField
              label={t('clientName')}
              placeholder={t('searchClients')}
              value={form.client}
              onSearch={handleClientSearch}
              onSelect={(item) => updateField('client', item)}
              onClear={() => updateField('client', null)}
              testID="client-autocomplete"
            />
          </View>

          <View style={{ zIndex: 2 }}>
            <AutocompleteField
              label={t('projectName')}
              placeholder={t('searchProjects')}
              value={form.project}
              onSearch={handleProjectSearch}
              onSelect={(item) => updateField('project', item)}
              onClear={() => updateField('project', null)}
              testID="project-autocomplete"
            />
          </View>

          <DatePickerField
            label={t('date')}
            value={form.date}
            onChange={(date) => updateField('date', date ?? null)}
            maxDate={new Date()}
            minDate={new Date(2024, 0, 1)}
            placeholder={t('selectDate')}
            error={errors.date}
          />

          {/* === SECTION 4: Additional Info === */}
          <SectionTitle title={t('additionalInfo')} />

          {canSelectPartner && (
            <SelectField
              label={t('partner')}
              value={partnerValue}
              options={partnerOptions}
              onChange={handlePartnerChange}
            />
          )}

          <View style={{ zIndex: 1 }}>
            <AutocompleteField<OtherPartyItem>
              label={t('otherParty')}
              placeholder={t('searchOtherParties')}
              value={form.otherPartyType && form.otherPartyType !== 'text' && form.otherParty ? { id: form.otherPartyId ?? `prev_${form.otherParty}`, label: form.otherParty, type: form.otherPartyType, hasRealId: !!form.otherPartyId } as OtherPartyItem : null}
              onSearch={handleOtherPartySearch}
              onSelect={handleOtherPartySelect}
              onClear={handleOtherPartyClear}
              onTextChange={(text) => {
                updateField('otherParty', text);
                updateField('otherPartyType', 'text');
                updateField('otherPartyId', null);
              }}
              allowFreeText
              testID="otherparty-autocomplete"
            />
          </View>

          <Input
            label={t('notesOptional')}
            value={form.notes}
            onChangeText={(text) => updateField('notes', text)}
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />

          {/* === SECTION 5: Receipts === */}
          <SectionTitle title={t('attachments')} />

          <ReceiptPickerSection
            attachments={form.attachments}
            onPickCamera={handlePickCamera}
            onPickGallery={handlePickGallery}
            onPickDocument={handlePickDocument}
            onRemove={removeAttachment}
            maxAttachments={maxAttachments}
          />

          {/* Bottom spacer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit button */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              ...shadows.md,
            },
          ]}
        >
          <Button
            title={isSubmitting ? t('sendingTransaction') : t('submit')}
            onPress={handleSubmitPress}
            variant="gradient"
            size="lg"
            disabled={isSubmitting}
            loading={isSubmitting}
            testID="submit-transaction"
          />
        </View>
      </KeyboardAvoidingView>

      {/* Preview dialog */}
      <SubmissionPreviewDialog
        visible={previewVisible}
        fields={previewFields}
        amount={getActualAmount()}
        currency={form.currency}
        receiptCount={form.attachments.length}
        onConfirm={handleConfirmSubmit}
        onCancel={handleCancelPreview}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Text
      style={[
        typography.headingSmall,
        {
          color: colors.foreground,
          marginTop: spacing.lg,
          marginBottom: spacing.md,
        },
      ]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  amountInput: {
    flex: 1,
    marginEnd: 8,
  },
  toggleGroup: {
    flexDirection: 'row',
  },
  toggleBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
