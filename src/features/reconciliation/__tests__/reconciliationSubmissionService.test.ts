// jest-expo automocks react-native; service tests pulling in type exports
// from UI components need a fuller module surface.
jest.unmock('react-native');

// Mock expo-constants so src/services/config.ts loads without the native module.
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

// Stub lucide-react-native so transitive load of ReceiptPickerSection (for its
// ReceiptAttachment type export) does not trigger react-native-svg native boot.
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy(
    {},
    {
      get: () => stub,
    },
  );
});

import MockAdapter from 'axios-mock-adapter';
import { apiClient, uploadMultipart } from '@/services/apiClient';
import {
  buildReconciliationPayload,
  submitReconciliation,
} from '../services/reconciliationSubmissionService';
import { INITIAL_FORM_DATA, ReconciliationFormData } from '../types';
import type { ReceiptAttachment } from '@/features/transactions/components/ReceiptPickerSection';

const mock = new MockAdapter(apiClient);

afterEach(() => mock.reset());

function makeForm(overrides: Partial<ReconciliationFormData> = {}): ReconciliationFormData {
  return {
    ...INITIAL_FORM_DATA,
    statement: 'Test statement',
    totalAmount: '500',
    date: new Date(2025, 5, 15),
    senderChannel: '507f1f77bcf86cd799439011',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildReconciliationPayload
// ---------------------------------------------------------------------------
describe('buildReconciliationPayload', () => {
  it('maps all required fields to Arabic keys', () => {
    const payload = buildReconciliationPayload(makeForm());
    expect(payload['البيان']).toBe('Test statement');
    expect(payload['المبلغ الإجمالي']).toBe(500);
    expect(payload['العملة']).toBe('ريال سعودي');
    expect(payload['النوع']).toBe('normal');
    expect(payload['التاريخ']).toBe('2025-06-15');
    expect(payload['نوع المرسل']).toBe('المحفظة');
    expect(payload['نوع المستقبل']).toBe('المحفظة');
    expect(payload['قناة المرسل']).toBe('507f1f77bcf86cd799439011');
  });

  it('sanitizes statement text', () => {
    const payload = buildReconciliationPayload(makeForm({ statement: '  padded  ' }));
    expect(payload['البيان']).toBe('padded');
  });

  it('converts totalAmount from string to number', () => {
    const payload = buildReconciliationPayload(makeForm({ totalAmount: '1234.56' }));
    expect(payload['المبلغ الإجمالي']).toBe(1234.56);
    expect(typeof payload['المبلغ الإجمالي']).toBe('number');
  });

  it('includes bankFees when present', () => {
    const payload = buildReconciliationPayload(makeForm({ bankFees: '10.50' }));
    expect(payload['رسوم بنكية']).toBe(10.5);
    expect(payload['عملة الرسوم']).toBe('ريال سعودي');
  });

  it('omits bankFees when empty', () => {
    const payload = buildReconciliationPayload(makeForm({ bankFees: '' }));
    expect(payload['رسوم بنكية']).toBeNull();
    expect(payload['عملة الرسوم']).toBeNull();
  });

  it('omits bankFees when zero', () => {
    const payload = buildReconciliationPayload(makeForm({ bankFees: '0' }));
    expect(payload['رسوم بنكية']).toBeNull();
    expect(payload['عملة الرسوم']).toBeNull();
  });

  it('includes fromEmployee when fromType is employee', () => {
    const payload = buildReconciliationPayload(makeForm({
      fromType: 'employee',
      fromEmployee: '507f1f77bcf86cd799439011',
    }));
    expect(payload['الموظف المرسل']).toBe('507f1f77bcf86cd799439011');
  });

  it('sets fromEmployee to null when fromType is not employee', () => {
    const payload = buildReconciliationPayload(makeForm({
      fromType: 'المحفظة',
      fromEmployee: '507f1f77bcf86cd799439011',
    }));
    expect(payload['الموظف المرسل']).toBeNull();
  });

  it('includes toEmployee when toType is employee', () => {
    const payload = buildReconciliationPayload(makeForm({
      toType: 'employee',
      toEmployee: '507f1f77bcf86cd799439012',
    }));
    expect(payload['الموظف المستقبل']).toBe('507f1f77bcf86cd799439012');
  });

  it('sets toEmployee to null when toType is not employee', () => {
    const payload = buildReconciliationPayload(makeForm({
      toType: 'بطاقة البلاد',
      toEmployee: '507f1f77bcf86cd799439012',
    }));
    expect(payload['الموظف المستقبل']).toBeNull();
  });

  it('includes receiverChannel when provided', () => {
    const payload = buildReconciliationPayload(makeForm({
      receiverChannel: '507f1f77bcf86cd799439013',
    }));
    expect(payload['قناة المستقبل']).toBe('507f1f77bcf86cd799439013');
  });

  it('sets receiverChannel to null when empty', () => {
    const payload = buildReconciliationPayload(makeForm({ receiverChannel: null }));
    expect(payload['قناة المستقبل']).toBeNull();
  });

  it('includes notes when provided', () => {
    const payload = buildReconciliationPayload(makeForm({ notes: 'test notes' }));
    expect(payload['ملاحظات']).toBe('test notes');
  });

  it('sanitizes notes text', () => {
    const payload = buildReconciliationPayload(makeForm({ notes: '  trimmed  ' }));
    expect(payload['ملاحظات']).toBe('trimmed');
  });

  it('sets notes to null when empty', () => {
    const payload = buildReconciliationPayload(makeForm({ notes: '' }));
    expect(payload['ملاحظات']).toBeNull();
  });

  it('formats date as YYYY-MM-DD', () => {
    const payload = buildReconciliationPayload(makeForm({
      date: new Date(2025, 0, 5), // Jan 5, 2025
    }));
    expect(payload['التاريخ']).toBe('2025-01-05');
  });

  it('uses bankFeesCurrency value', () => {
    const payload = buildReconciliationPayload(makeForm({
      bankFees: '5',
      bankFeesCurrency: 'دولار أمريكي',
    }));
    expect(payload['عملة الرسوم']).toBe('دولار أمريكي');
  });
});

// ---------------------------------------------------------------------------
// submitReconciliation (API call)
// ---------------------------------------------------------------------------
describe('submitReconciliation', () => {
  it('returns success with reconciliation data on 201', async () => {
    const reconciliationData = {
      id: 'abc123',
      statement: 'Test',
      totalAmount: 500,
      currency: 'ريال سعودي',
    };
    mock.onPost('/reconciliation').reply(201, {
      success: true,
      reconciliation: reconciliationData,
    });

    const result = await submitReconciliation(makeForm());
    expect(result.success).toBe(true);
    expect(result.reconciliation).toEqual(reconciliationData);
  });

  it('returns error on 403', async () => {
    mock.onPost('/reconciliation').reply(403, { message: 'Forbidden' });

    const result = await submitReconciliation(makeForm());
    expect(result.success).toBe(false);
    expect(result.error).toBe('FORBIDDEN');
  });

  it('returns error on network failure', async () => {
    mock.onPost('/reconciliation').networkError();

    const result = await submitReconciliation(makeForm());
    expect(result.success).toBe(false);
    expect(result.error).toBe('NETWORK');
  });

  it('returns error on server error', async () => {
    mock.onPost('/reconciliation').reply(500, { message: 'Internal' });

    const result = await submitReconciliation(makeForm());
    expect(result.success).toBe(false);
    expect(result.error).toBe('SERVER');
  });

  it('returns error when success is false in response', async () => {
    mock.onPost('/reconciliation').reply(200, { success: false });

    const result = await submitReconciliation(makeForm());
    expect(result.success).toBe(false);
    expect(result.error).toBe('SERVER');
  });

  it('always uses JSON POST even when attachments are present', async () => {
    mock.onPost('/reconciliation').reply(201, {
      success: true,
      reconciliation: { id: 'abc', statement: 'Test', totalAmount: 500, currency: 'ريال سعودي' },
    });

    const attachments: ReceiptAttachment[] = [
      { id: 'att1', uri: 'file:///tmp/photo.jpg', type: 'image', name: 'photo.jpg', mimeType: 'image/jpeg', fileSize: 1024 },
    ];

    const result = await submitReconciliation(makeForm({ attachments }));
    expect(result.success).toBe(true);
    // Backend doesn't support multipart yet — always JSON
    const request = mock.history.post[0];
    expect(request.data).not.toBeInstanceOf(FormData);
  });
});
