import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { AutocompleteField, AutocompleteItem } from '@/components/ui/AutocompleteField';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { Button } from '@/components/ui/Button';
import { DetailRow } from '@/components/finance/DetailRow';
import { ReceiptPickerSection, MAX_ATTACHMENTS } from '@/features/transactions/components/ReceiptPickerSection';
import { ReconciliationFlowWidget } from './ReconciliationFlowWidget';
import { ReconciliationPreviewDialog } from './ReconciliationPreviewDialog';
import { useReconciliationForm } from '../hooks/useReconciliationForm';
import { useShareIntent } from '@/hooks/useShareIntent';
import { convertSharedFilesToAttachments } from '@/utils/sharedFilesAdapter';
import { FORM_TOTAL_STEPS, ENTITY_TYPES } from '../types';
import { buildReconciliationPayload } from '../services/reconciliationSubmissionService';
import { formatDate } from '@/utils/formatters';
import { buildReconciliationPreviewFields, ReconciliationPreviewPayload } from '../utils/previewFields';
import { isPositiveAmount } from '@/utils/sanitize';
import { getMaxAllowedDate } from '@/utils/dateLimits';

interface ReconciliationFormScreenProps {
  onClose: () => void;
  onSubmitted?: () => void;
}

const CURRENCY_OPTIONS = [
  { label: 'ريال سعودي', value: 'ريال سعودي' },
  { label: 'دولار أمريكي', value: 'دولار أمريكي' },
];

const TYPE_OPTIONS_KEYS = [
  { labelKey: 'salary', value: 'salary' },
  { labelKey: 'bonus', value: 'bonus' },
  { labelKey: 'normal', value: 'normal' },
];

export function ReconciliationFormScreen({ onClose, onSubmitted }: ReconciliationFormScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const [previewVisible, setPreviewVisible] = useState(false);

  const {
    form,
    step,
    updateField,
    currentStepErrors,
    currentStepValid,
    canGoPrev,
    isLastStep,
    goNext,
    goPrev,
    submit,
    isSubmitting,
    employees,
    channels,
    totalSteps,
    addAttachment,
    removeAttachment,
    canAddMore,
    maxAttachments,
  } = useReconciliationForm({
    onSuccess: () => {
      onSubmitted?.();
      onClose();
    },
  });

  // Consume shared files targeted at reconciliation on mount
  const { state: shareState, consumeFiles } = useShareIntent();
  const consumedRef = useRef(false);
  useEffect(() => {
    if (
      !consumedRef.current &&
      shareState.status === 'flow_selected' &&
      shareState.targetId === 'reconciliation'
    ) {
      consumedRef.current = true;
      const sharedFiles = consumeFiles();
      const { attachments } = convertSharedFilesToAttachments(sharedFiles, form.attachments.length, MAX_ATTACHMENTS);
      for (const att of attachments) {
        addAttachment(att.uri, att.type, att.name ?? 'attachment', att.mimeType ?? 'application/octet-stream', att.fileSize);
      }
    }
  }, [shareState]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedFromEmployee, setSelectedFromEmployee] = useState<AutocompleteItem | null>(null);
  const [selectedToEmployee, setSelectedToEmployee] = useState<AutocompleteItem | null>(null);

  // Track keyboard height to add bottom padding so all fields remain scrollable
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const errors = currentStepErrors;

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

  // Options derived from reference data
  const channelOptions = useMemo(
    () => channels.map((c) => ({ label: c.name, value: c.id })),
    [channels],
  );

  const entityTypeOptions = useMemo(() => {
    const map: Record<string, string> = {
      'المحفظة': t('entityTypeWallet'),
      'employee': t('entityTypeEmployee'),
      'بطاقة البلاد': t('entityTypeBiladCard'),
    };
    return ENTITY_TYPES.map((v) => ({ label: map[v] ?? v, value: v }));
  }, [t]);

  const handleEmployeeSearch = useCallback(
    async (query: string): Promise<AutocompleteItem[]> => {
      const q = query.toLowerCase();
      return employees
        .filter((e) => e.name && e.name.toLowerCase().includes(q))
        .map((e) => ({ id: e.id, label: e.name }));
    },
    [employees],
  );

  const typeOptions = useMemo(
    () => TYPE_OPTIONS_KEYS.map((o) => ({ label: t(o.labelKey), value: o.value })),
    [t],
  );

  // Show bankFeesCurrency only when bankFees is a positive number.
  // Orphan currency state is also stripped at submission
  // (see buildReconciliationPayload).
  const showBankFeesCurrency = useMemo(
    () => isPositiveAmount(form.bankFees),
    [form.bankFees],
  );

  // Build preview data
  const previewFields = useMemo(() => {
    const payload = buildReconciliationPayload(form) as ReconciliationPreviewPayload;
    return buildReconciliationPreviewFields({
      payload,
      typeKey: form.type,
      formattedDate: form.date ? formatDate(form.date.toISOString()) : null,
      t,
    });
  }, [form, t]);

  // Submit flow
  const handleNextOrSubmit = useCallback(() => {
    if (isLastStep) {
      if (!currentStepValid) {
        goNext(); // triggers validation display
        return;
      }
      setPreviewVisible(true);
    } else {
      goNext();
    }
  }, [isLastStep, currentStepValid, goNext]);

  const handleConfirmSubmit = useCallback(async () => {
    setPreviewVisible(false);
    const result = await submit();
    if (result.success) {
      Alert.alert('', t('reconciliationSubmittedSuccessfully'));
    } else if (result.error) {
      const errorMap: Record<string, string> = {
        FORBIDDEN: t('reconciliationCreateForbidden'),
        NETWORK: t('reconciliationCreateNetworkError'),
        SERVER: t('reconciliationCreateFailed'),
      };
      Alert.alert(t('error'), errorMap[result.error] ?? t('reconciliationCreateFailed'));
    }
  }, [submit, t]);

  const handleCancelPreview = useCallback(() => {
    setPreviewVisible(false);
  }, []);

  // Flow widget data for summary and preview
  const fromEmployeeObj = form.fromType === 'employee' && form.fromEmployee
    ? { id: form.fromEmployee, name: employees.find((e) => e.id === form.fromEmployee)?.name ?? null }
    : null;
  const toEmployeeObj = form.toType === 'employee' && form.toEmployee
    ? { id: form.toEmployee, name: employees.find((e) => e.id === form.toEmployee)?.name ?? null }
    : null;
  const senderChannelObj = form.senderChannel
    ? { id: form.senderChannel, name: channels.find((c) => c.id === form.senderChannel)?.name ?? null }
    : null;
  const receiverChannelObj = form.receiverChannel
    ? { id: form.receiverChannel, name: channels.find((c) => c.id === form.receiverChannel)?.name ?? null }
    : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[typography.headingSmall, { color: colors.foreground, flex: 1, textAlign: 'center' }]}>
          {t('newReconciliation')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xs }]}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressBar,
              {
                backgroundColor: i <= step ? colors.primary : colors.muted,
                borderRadius: 2,
                marginEnd: i < totalSteps - 1 ? spacing.xs : 0,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[typography.labelSmall, { color: colors.foregroundSecondary, textAlign: 'center', marginBottom: spacing.xs }]}>
        {t('stepOf', { current: step + 1, total: totalSteps })}
      </Text>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { padding: spacing.base }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <>
              <SectionTitle title={t('basicInfo')} />

              <Input
                label={`${t('statement')} *`}
                value={form.statement}
                onChangeText={(text) => updateField('statement', text)}
                error={errors.statement ? t(errors.statement) : undefined}
                placeholder={t('enterReconciliationDescription')}
                returnKeyType="next"
              />

              <Input
                label={`${t('totalAmount')} *`}
                value={form.totalAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  updateField('totalAmount', cleaned);
                }}
                error={errors.totalAmount ? t(errors.totalAmount) : undefined}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              <SelectField
                label={t('currency')}
                value={form.currency}
                options={CURRENCY_OPTIONS}
                onChange={(val) => updateField('currency', val as any)}
              />

              <Input
                label={`${t('bankFees')} *`}
                value={form.bankFees}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  updateField('bankFees', cleaned);
                }}
                error={errors.bankFees ? t(errors.bankFees) : undefined}
                keyboardType="decimal-pad"
                placeholder={t('enterBankFees')}
              />

              {showBankFeesCurrency && (
                <SelectField
                  label={t('feesCurrency')}
                  value={form.bankFeesCurrency}
                  options={CURRENCY_OPTIONS}
                  onChange={(val) => updateField('bankFeesCurrency', val as any)}
                  error={errors.bankFeesCurrency ? t(errors.bankFeesCurrency) : undefined}
                />
              )}

              <DatePickerField
                label={`${t('date')} *`}
                value={form.date}
                onChange={(date) => updateField('date', date ?? null)}
                maxDate={getMaxAllowedDate()}
                minDate={new Date(2024, 0, 1)}
                placeholder={t('selectDate')}
                error={errors.date ? t(errors.date) : undefined}
              />
            </>
          )}

          {/* Step 1: Reconciliation Type */}
          {step === 1 && (
            <>
              <SectionTitle title={t('reconciliationType')} />

              <SelectField
                label={`${t('reconciliationType')} *`}
                value={form.type}
                options={typeOptions}
                onChange={(val) => updateField('type', val as any)}
                error={errors.type ? t(errors.type) : undefined}
              />
            </>
          )}

          {/* Step 2: Sender Details */}
          {step === 2 && (
            <>
              <SectionTitle title={t('senderDetails')} />

              <SelectField
                label={`${t('senderType')} *`}
                value={form.fromType}
                options={entityTypeOptions}
                onChange={(val) => {
                  updateField('fromType', val as any);
                  if (val !== 'employee') {
                    updateField('fromEmployee', '');
                    setSelectedFromEmployee(null);
                  }
                }}
                error={errors.fromType ? t(errors.fromType) : undefined}
              />

              {form.fromType === 'employee' && (
                <AutocompleteField
                  label={`${t('senderEmployee')} *`}
                  value={selectedFromEmployee}
                  placeholder={t('selectEmployee')}
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
                  error={errors.fromEmployee ? t(errors.fromEmployee) : undefined}
                  testID="from-employee-autocomplete"
                />
              )}

              <SelectField
                label={`${t('senderChannel')} *`}
                value={form.senderChannel}
                options={channelOptions}
                onChange={(val) => updateField('senderChannel', val)}
                placeholder={t('selectSenderChannel')}
                error={errors.senderChannel ? t(errors.senderChannel) : undefined}
              />
            </>
          )}

          {/* Step 3: Receiver Details */}
          {step === 3 && (
            <>
              <SectionTitle title={t('receiverDetails')} />

              <SelectField
                label={`${t('receiverType')} *`}
                value={form.toType}
                options={entityTypeOptions}
                onChange={(val) => {
                  updateField('toType', val as any);
                  if (val !== 'employee') {
                    updateField('toEmployee', '');
                    setSelectedToEmployee(null);
                  }
                }}
                error={errors.toType ? t(errors.toType) : undefined}
              />

              {form.toType === 'employee' && (
                <AutocompleteField
                  label={`${t('receiverEmployee')} *`}
                  value={selectedToEmployee}
                  placeholder={t('selectEmployee')}
                  onSearch={handleEmployeeSearch}
                  onSelect={(item) => {
                    updateField('toEmployee', item.id);
                    setSelectedToEmployee(item);
                  }}
                  onClear={() => {
                    updateField('toEmployee', '');
                    setSelectedToEmployee(null);
                  }}
                  minChars={0}
                  error={errors.toEmployee ? t(errors.toEmployee) : undefined}
                  testID="to-employee-autocomplete"
                />
              )}

              <SelectField
                label={`${t('receiverChannel')} *`}
                value={form.receiverChannel}
                options={channelOptions}
                onChange={(val) => updateField('receiverChannel', val)}
                placeholder={t('selectReceiverChannel')}
                error={errors.receiverChannel ? t(errors.receiverChannel) : undefined}
              />
            </>
          )}

          {/* Step 4: Additional Info + Summary */}
          {step === 4 && (
            <>
              <SectionTitle title={t('additionalInfo')} />

              <Input
                label={t('notesOptional')}
                value={form.notes}
                onChangeText={(text) => updateField('notes', text)}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
              />

              <SectionTitle title={t('attachments')} />
              <ReceiptPickerSection
                attachments={form.attachments}
                onPickCamera={handlePickCamera}
                onPickGallery={handlePickGallery}
                onPickDocument={handlePickDocument}
                onRemove={removeAttachment}
                maxAttachments={maxAttachments}
              />

              <SectionTitle title={t('reconciliationSummary')} />

              <View style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}>
                <DetailRow label={t('statement')} value={form.statement.trim() || null} />
                <DetailRow
                  label={t('totalAmount')}
                  value={form.totalAmount || null}
                  valueColor={colors.primary}
                />
                <DetailRow label={t('currency')} value={form.currency} />
                <DetailRow label={t('reconciliationType')} value={t(form.type)} />
                <DetailRow label={t('date')} value={form.date ? formatDate(form.date.toISOString()) : null} />
                {showBankFeesCurrency && (
                  <DetailRow
                    label={t('bankFees')}
                    value={`${form.bankFees} ${form.bankFeesCurrency}`}
                  />
                )}
                {form.notes.trim() && (
                  <DetailRow label={t('notes')} value={form.notes.trim()} />
                )}
              </View>

              <View style={{ marginTop: spacing.md }}>
                <ReconciliationFlowWidget
                  fromType={form.fromType}
                  fromEmployee={fromEmployeeObj}
                  senderChannel={senderChannelObj}
                  toType={form.toType}
                  toEmployee={toEmployeeObj}
                  receiverChannel={receiverChannelObj}
                />
              </View>
            </>
          )}

          {/* Bottom spacer — grows when keyboard is open so all fields remain scrollable */}
          <View style={{ height: 100 + keyboardHeight }} />
        </ScrollView>

        {/* Bottom navigation */}
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
          <View style={[styles.navRow, { gap: spacing.md }]}>
            {canGoPrev && (
              <View style={{ flex: 1 }}>
                <Button
                  title={t('previous')}
                  onPress={goPrev}
                  variant="outline"
                  size="lg"
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button
                title={
                  isSubmitting
                    ? t('submittingReconciliation')
                    : isLastStep
                      ? t('submitReconciliation')
                      : t('next')
                }
                onPress={handleNextOrSubmit}
                variant="gradient"
                size="lg"
                disabled={isSubmitting}
                loading={isSubmitting}
                testID="reconciliation-next-submit"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Preview dialog */}
      <ReconciliationPreviewDialog
        visible={previewVisible}
        fields={previewFields}
        amount={form.totalAmount}
        currency={form.currency}
        fromType={form.fromType}
        fromEmployee={fromEmployeeObj}
        senderChannel={senderChannelObj}
        toType={form.toType}
        toEmployee={toEmployeeObj}
        receiverChannel={receiverChannelObj}
        attachmentCount={form.attachments.length}
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
  progressRow: {
    flexDirection: 'row',
  },
  progressBar: {
    flex: 1,
    height: 4,
  },
  scrollContent: {
    flexGrow: 1,
  },
  summaryCard: {},
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
  },
});
