import { formatAmount } from '@/utils/formatters';

export interface ReconciliationPreviewPayload {
  'البيان': string | number | null;
  'العملة': string | number | null;
  'رسوم بنكية': number | null;
  'عملة الرسوم': string | null;
  'ملاحظات': string | number | null;
  [key: string]: unknown;
}

export interface PreviewFieldDescriptor {
  label: string;
  value: string | number | null;
}

export interface BuildReconciliationPreviewFieldsArgs {
  payload: ReconciliationPreviewPayload;
  typeKey: string;
  formattedDate: string | null;
  t: (key: string) => string;
}

/** Build the preview field rows for the reconciliation submission dialog.
 *  Pure function; date is pre-formatted by the caller and the type translation key is
 *  passed through `typeKey` so the helper stays decoupled from form state. */
export function buildReconciliationPreviewFields({
  payload,
  typeKey,
  formattedDate,
  t,
}: BuildReconciliationPreviewFieldsArgs): PreviewFieldDescriptor[] {
  const bankFees = payload['رسوم بنكية'];
  const bankFeesCurrency = payload['عملة الرسوم'] ?? '';

  const fields: PreviewFieldDescriptor[] = [
    { label: t('statement'), value: payload['البيان'] },
    { label: t('currency'), value: payload['العملة'] },
    { label: t('reconciliationType'), value: t(typeKey) },
    { label: t('date'), value: formattedDate },
  ];

  if (bankFees != null) {
    fields.push({
      label: t('bankFees'),
      value: `${formatAmount(bankFees)} ${bankFeesCurrency}`,
    });
  }

  if (payload['ملاحظات']) {
    fields.push({ label: t('notes'), value: payload['ملاحظات'] });
  }

  return fields;
}
