import {
  formatHeadlineAmount,
  buildTransactionPreviewFields,
  TransactionPreviewPayload,
} from '../utils/previewFields';

const tStub = (key: string) => key;

describe('formatHeadlineAmount', () => {
  it('formats negative sign-prefixed string with thousands separators and 2dp', () => {
    expect(formatHeadlineAmount('-1234567.89')).toEqual({
      display: '1,234,567.89',
      isExpense: true,
    });
  });

  it('formats positive numeric string with thousands separators and 2dp', () => {
    expect(formatHeadlineAmount('1000')).toEqual({
      display: '1,000.00',
      isExpense: false,
    });
  });

  it('formats small negative amount', () => {
    expect(formatHeadlineAmount('-1234.56')).toEqual({
      display: '1,234.56',
      isExpense: true,
    });
  });

  it('returns empty display for null without crashing', () => {
    expect(formatHeadlineAmount(null)).toEqual({
      display: '',
      isExpense: false,
    });
  });

  it('returns empty display for empty string without crashing', () => {
    expect(formatHeadlineAmount('')).toEqual({
      display: '',
      isExpense: false,
    });
  });

  it('returns raw string when value is not parseable as number', () => {
    expect(formatHeadlineAmount('abc')).toEqual({
      display: 'abc',
      isExpense: false,
    });
  });

  it('handles plain numeric value', () => {
    expect(formatHeadlineAmount(2500)).toEqual({
      display: '2,500.00',
      isExpense: false,
    });
  });
});

describe('buildTransactionPreviewFields', () => {
  const basePayload: TransactionPreviewPayload = {
    'البيان': 'Lunch',
    'العملة': 'ريال سعودي',
    'الضريبة': 'لا',
    'رسوم بنكية': null,
    'عملة الرسوم': null,
    'التاريخ': '15/03/2025',
    'رمز المشروع': 'PRJ-1',
    'اسم العميل': 'Acme',
    'ملاحظات': null,
  };

  it('formats bank fees with thousands separators and currency suffix', () => {
    const fields = buildTransactionPreviewFields(
      { ...basePayload, 'رسوم بنكية': 1234567.89, 'عملة الرسوم': 'ريال سعودي' },
      tStub,
    );
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField).toBeDefined();
    expect(bankFeesField!.value).toBe('1,234,567.89 ريال سعودي');
  });

  it('formats small bank fees with 2dp', () => {
    const fields = buildTransactionPreviewFields(
      { ...basePayload, 'رسوم بنكية': 25, 'عملة الرسوم': 'ريال سعودي' },
      tStub,
    );
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField!.value).toBe('25.00 ريال سعودي');
  });

  it('uses empty string when bank fees currency is missing', () => {
    const fields = buildTransactionPreviewFields(
      { ...basePayload, 'رسوم بنكية': 1500, 'عملة الرسوم': null },
      tStub,
    );
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField!.value).toBe('1,500.00 ');
  });

  it('omits bank fees row when value is null', () => {
    const fields = buildTransactionPreviewFields(basePayload, tStub);
    expect(fields.find((f) => f.label === 'bankFees')).toBeUndefined();
  });

  it('omits bank fees row when value is zero', () => {
    const fields = buildTransactionPreviewFields(
      { ...basePayload, 'رسوم بنكية': 0, 'عملة الرسوم': 'ريال سعودي' },
      tStub,
    );
    expect(fields.find((f) => f.label === 'bankFees')).toBeUndefined();
  });

  it('includes notes row only when notes are present', () => {
    const withNotes = buildTransactionPreviewFields(
      { ...basePayload, 'ملاحظات': 'Some note' },
      tStub,
    );
    expect(withNotes.find((f) => f.label === 'notes')?.value).toBe('Some note');

    const withoutNotes = buildTransactionPreviewFields(basePayload, tStub);
    expect(withoutNotes.find((f) => f.label === 'notes')).toBeUndefined();
  });
});
