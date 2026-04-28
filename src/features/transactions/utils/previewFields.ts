import { formatAmount } from '@/utils/formatters';

export interface TransactionPreviewPayload {
  'البيان': string | number | null;
  'العملة': string | number | null;
  'الضريبة': string | number | null;
  'رسوم بنكية': number | null;
  'عملة الرسوم': string | null;
  'التاريخ': string | number | null;
  'رمز المشروع': string | number | null;
  'اسم العميل': string | number | null;
  'ملاحظات': string | number | null;
  [key: string]: unknown;
}

export interface PreviewFieldDescriptor {
  label: string;
  value: string | number | null | undefined;
  highlight?: 'error' | 'success' | 'warning';
}

export interface HeadlineAmount {
  display: string;
  isExpense: boolean;
}

/** Format the headline amount for the submission preview dialog.
 *  Accepts a sign-prefixed numeric string ("-1234.56") or a number.
 *  Returns the formatted absolute value plus an isExpense flag derived from a leading "-".
 *  Falls back to the raw string for unparseable input; returns empty for null/empty. */
export function formatHeadlineAmount(
  amount: string | number | null | undefined,
): HeadlineAmount {
  if (amount === null || amount === undefined) {
    return { display: '', isExpense: false };
  }
  const raw = String(amount);
  if (raw.trim() === '') {
    return { display: '', isExpense: false };
  }
  const isExpense = raw.startsWith('-');
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) {
    return { display: raw, isExpense };
  }
  return { display: formatAmount(Math.abs(parsed)), isExpense };
}

/** Build the preview field rows for the transaction submission dialog.
 *  Pure function; takes a `t` translator so it can be unit-tested without React context. */
export function buildTransactionPreviewFields(
  data: TransactionPreviewPayload,
  t: (key: string) => string,
): PreviewFieldDescriptor[] {
  const bankFees = data['رسوم بنكية'];
  const bankFeesCurrency = data['عملة الرسوم'] ?? '';

  return [
    { label: t('statement'), value: data['البيان'] },
    { label: t('currency'), value: data['العملة'] },
    {
      label: t('tax'),
      value: data['الضريبة'] === 'نعم' ? t('yes') : t('no'),
      highlight: 'error' as const,
    },
    ...(bankFees != null && bankFees !== 0
      ? [{
          label: t('bankFees'),
          value: `${formatAmount(bankFees)} ${bankFeesCurrency}`,
          highlight: 'warning' as const,
        }]
      : []),
    { label: t('date'), value: data['التاريخ'] },
    { label: t('project'), value: data['رمز المشروع'] },
    { label: t('clientName'), value: data['اسم العميل'] },
    ...(data['ملاحظات']
      ? [{ label: t('notes'), value: data['ملاحظات'] }]
      : []),
  ];
}
