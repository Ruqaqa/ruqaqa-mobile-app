import {
  buildReconciliationPreviewFields,
  ReconciliationPreviewPayload,
} from '../utils/previewFields';

const tStub = (key: string) => key;

describe('buildReconciliationPreviewFields', () => {
  const basePayload: ReconciliationPreviewPayload = {
    'البيان': 'Statement',
    'العملة': 'ريال سعودي',
    'رسوم بنكية': null,
    'عملة الرسوم': null,
    'ملاحظات': null,
  };

  it('formats bank fees with thousands separators and currency suffix', () => {
    const fields = buildReconciliationPreviewFields({
      payload: {
        ...basePayload,
        'رسوم بنكية': 1234567.89,
        'عملة الرسوم': 'ريال سعودي',
      },
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField).toBeDefined();
    expect(bankFeesField!.value).toBe('1,234,567.89 ريال سعودي');
  });

  it('formats small bank fees with 2dp', () => {
    const fields = buildReconciliationPreviewFields({
      payload: {
        ...basePayload,
        'رسوم بنكية': 10.5,
        'عملة الرسوم': 'ريال سعودي',
      },
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField!.value).toBe('10.50 ريال سعودي');
  });

  it('uses empty string when bank fees currency is missing', () => {
    const fields = buildReconciliationPreviewFields({
      payload: {
        ...basePayload,
        'رسوم بنكية': 1500,
        'عملة الرسوم': null,
      },
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField!.value).toBe('1,500.00 ');
  });

  it('omits bank fees row when value is null', () => {
    const fields = buildReconciliationPreviewFields({
      payload: basePayload,
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    expect(fields.find((f) => f.label === 'bankFees')).toBeUndefined();
  });

  it('keeps zero bank fees row visible (matches existing != null check)', () => {
    const fields = buildReconciliationPreviewFields({
      payload: {
        ...basePayload,
        'رسوم بنكية': 0,
        'عملة الرسوم': 'ريال سعودي',
      },
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    const bankFeesField = fields.find((f) => f.label === 'bankFees');
    expect(bankFeesField!.value).toBe('0.00 ريال سعودي');
  });

  it('includes notes row only when notes are present', () => {
    const withNotes = buildReconciliationPreviewFields({
      payload: { ...basePayload, 'ملاحظات': 'Some note' },
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    expect(withNotes.find((f) => f.label === 'notes')?.value).toBe('Some note');

    const withoutNotes = buildReconciliationPreviewFields({
      payload: basePayload,
      typeKey: 'salary',
      formattedDate: '15/03/2025',
      t: tStub,
    });
    expect(withoutNotes.find((f) => f.label === 'notes')).toBeUndefined();
  });
});
