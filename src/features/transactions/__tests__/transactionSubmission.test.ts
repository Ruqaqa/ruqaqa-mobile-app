import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  submitTransaction,
  buildTransactionFormData,
  SubmissionError,
  TransactionSubmissionData,
  _resetSubmissionGuard,
} from '../services/transactionSubmissionService';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return {
    apiClient: mockAxios,
    uploadMultipart: jest.fn(),
  };
});

import { uploadMultipart } from '@/services/apiClient';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
  jest.clearAllMocks();
  _resetSubmissionGuard();
});

afterEach(() => {
  mock.restore();
});

// Valid 24-char hex ObjectIds for test data
const VALID_EMPLOYEE_ID = 'aabbccddeeff00112233aabb';
const VALID_CLIENT_ID = '112233445566778899aabbcc';
const VALID_PROJECT_ID = 'ffeeddccbbaa998877665544';

function makeValidSubmission(
  overrides: Partial<TransactionSubmissionData> = {},
): TransactionSubmissionData {
  return {
    statement: 'Office supplies',
    totalAmount: '500',
    currency: 'ريال سعودي',
    tax: 'لا',
    transactionDate: '03/27/2026',
    partnerEmployee: VALID_EMPLOYEE_ID,
    otherParty: 'Vendor Corp',
    otherPartyType: 'text',
    otherPartyId: null,
    client: VALID_CLIENT_ID,
    project: VALID_PROJECT_ID,
    notes: 'Test notes',
    bankFees: null,
    bankFeesCurrency: null,
    receipts: [],
    ...overrides,
  };
}

describe('buildTransactionFormData', () => {
  it('builds FormData with data field as JSON string', () => {
    const submission = makeValidSubmission();
    const formData = buildTransactionFormData(submission);

    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('data')).toBeDefined();

    const parsed = JSON.parse(formData.get('data') as string);
    expect(parsed['البيان']).toBe('Office supplies');
    expect(parsed['المبلغ الإجمالي']).toBe('500');
    expect(parsed['العملة']).toBe('ريال سعودي');
  });

  it('sanitizes text fields by trimming whitespace', () => {
    const submission = makeValidSubmission({
      statement: '  Office supplies  ',
      notes: '  Some notes  ',
    });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['البيان']).toBe('Office supplies');
    expect(parsed['ملاحظات']).toBe('Some notes');
  });

  it('caps notes at 1000 chars', () => {
    const longNotes = 'x'.repeat(1500);
    const submission = makeValidSubmission({ notes: longNotes });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['ملاحظات']).toHaveLength(1000);
  });

  it('includes bank fees when provided as string', () => {
    const submission = makeValidSubmission({
      bankFees: '25',
      bankFeesCurrency: 'ريال سعودي',
    });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['رسوم بنكية']).toBe(25);
    expect(parsed['عملة الرسوم']).toBe('ريال سعودي');
  });

  it('omits bank fees when null', () => {
    const submission = makeValidSubmission({ bankFees: null });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['رسوم بنكية']).toBeUndefined();
    expect(parsed['عملة الرسوم']).toBeUndefined();
  });

  it('omits bank fees when empty string', () => {
    const submission = makeValidSubmission({ bankFees: '' });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['رسوم بنكية']).toBeUndefined();
  });

  it('omits bank fees when zero string', () => {
    const submission = makeValidSubmission({ bankFees: '0' });
    const formData = buildTransactionFormData(submission);
    const parsed = JSON.parse(formData.get('data') as string);

    expect(parsed['رسوم بنكية']).toBeUndefined();
  });

  it('appends receipt files under receipts key', () => {
    const mockFile = new File(['data'], 'receipt.jpg', { type: 'image/jpeg' });
    const submission = makeValidSubmission({ receipts: [mockFile] });
    const formData = buildTransactionFormData(submission);

    expect(formData.getAll('receipts')).toHaveLength(1);
  });

  it('appends multiple receipt files', () => {
    const files = [
      new File(['a'], 'r1.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'r2.png', { type: 'image/png' }),
    ];
    const submission = makeValidSubmission({ receipts: files });
    const formData = buildTransactionFormData(submission);

    expect(formData.getAll('receipts')).toHaveLength(2);
  });

  // --- Validation: currency ---

  it('throws VALIDATION for invalid currency', () => {
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ currency: 'euro' })),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('accepts دولار أمريكي as valid currency', () => {
    const formData = buildTransactionFormData(
      makeValidSubmission({ currency: 'دولار أمريكي' }),
    );
    const parsed = JSON.parse(formData.get('data') as string);
    expect(parsed['العملة']).toBe('دولار أمريكي');
  });

  // --- Validation: amount ---

  it('throws VALIDATION for negative amount', () => {
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ totalAmount: '-500' })),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('throws VALIDATION for non-numeric amount', () => {
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ totalAmount: 'abc' })),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('accepts valid decimal amount', () => {
    const formData = buildTransactionFormData(
      makeValidSubmission({ totalAmount: '123.45' }),
    );
    const parsed = JSON.parse(formData.get('data') as string);
    expect(parsed['المبلغ الإجمالي']).toBe('123.45');
  });

  // --- Validation: ObjectId ---

  it('throws VALIDATION for invalid partnerEmployee ID', () => {
    expect(() =>
      buildTransactionFormData(
        makeValidSubmission({ partnerEmployee: 'not-an-objectid' }),
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('allows null partnerEmployee', () => {
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ partnerEmployee: null })),
    ).not.toThrow();
  });

  it('throws VALIDATION for invalid client ID', () => {
    expect(() =>
      buildTransactionFormData(
        makeValidSubmission({ client: 'bad-id' }),
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('throws VALIDATION for invalid project ID', () => {
    expect(() =>
      buildTransactionFormData(
        makeValidSubmission({ project: 'bad-id' }),
      ),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  // --- Validation: file uploads ---

  it('throws VALIDATION for disallowed MIME type', () => {
    const badFile = new File(['data'], 'script.js', {
      type: 'application/javascript',
    });
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ receipts: [badFile] })),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('accepts allowed MIME types', () => {
    const files = [
      new File(['a'], 'photo.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'doc.pdf', { type: 'application/pdf' }),
      new File(['c'], 'pic.webp', { type: 'image/webp' }),
    ];
    expect(() =>
      buildTransactionFormData(makeValidSubmission({ receipts: files })),
    ).not.toThrow();
  });

  it('sanitizes filenames with path separators', () => {
    const badNameFile = new File(['data'], '../../etc/passwd', {
      type: 'image/jpeg',
    });
    const formData = buildTransactionFormData(
      makeValidSubmission({ receipts: [badNameFile] }),
    );
    const receipts = formData.getAll('receipts') as File[];
    expect(receipts[0].name).not.toContain('/');
    expect(receipts[0].name).not.toContain('\\');
  });
});

describe('submitTransaction', () => {
  it('calls uploadMultipart on success', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValueOnce({
      data: {
        success: true,
        transaction: { id: 'txn-1', transactionNumber: 'TXN-001' },
      },
    });

    const result = await submitTransaction(makeValidSubmission());

    expect(uploadMultipart).toHaveBeenCalledWith(
      '/transactions',
      expect.any(FormData),
      undefined,
    );
    expect(result.success).toBe(true);
    expect(result.transactionNumber).toBe('TXN-001');
  });

  it('passes onProgress to uploadMultipart', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValueOnce({
      data: { success: true, transaction: { id: 'txn-1' } },
    });

    const onProgress = jest.fn();
    await submitTransaction(makeValidSubmission(), onProgress);

    expect(uploadMultipart).toHaveBeenCalledWith(
      '/transactions',
      expect.any(FormData),
      onProgress,
    );
  });

  it('throws VALIDATION error when server returns success false', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValueOnce({
      data: {
        success: false,
        message: 'Invalid statement',
      },
    });

    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION' }),
    );
  });

  it('throws FORBIDDEN on 403', async () => {
    const error = new axios.AxiosError('Forbidden', '403', undefined, undefined, {
      status: 403,
      data: {},
      statusText: 'Forbidden',
      headers: {},
      config: {} as any,
    });
    (uploadMultipart as jest.Mock).mockRejectedValueOnce(error);

    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws NETWORK on network error', async () => {
    const error = new axios.AxiosError('Network Error');
    // No response = network error
    (uploadMultipart as jest.Mock).mockRejectedValueOnce(error);

    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow(
      expect.objectContaining({ code: 'NETWORK' }),
    );
  });

  it('throws SERVER on 500', async () => {
    const error = new axios.AxiosError('Server Error', '500', undefined, undefined, {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      config: {} as any,
    });
    (uploadMultipart as jest.Mock).mockRejectedValueOnce(error);

    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    );
  });

  it('prevents double submission', async () => {
    // First call hangs (never resolves during this test)
    (uploadMultipart as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

    // Fire first submission (don't await)
    const firstPromise = submitTransaction(makeValidSubmission());

    // Second call should throw immediately
    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION' }),
    );

    // Clean up: the first promise never resolves, but the guard resets via _resetSubmissionGuard in beforeEach
    // Suppress unhandled rejection from the hanging promise
    firstPromise.catch(() => {});
  });

  it('resets submission guard after success', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValue({
      data: { success: true, transaction: { id: 'txn-1' } },
    });

    await submitTransaction(makeValidSubmission());
    // Second submission should work
    const result = await submitTransaction(makeValidSubmission());
    expect(result.success).toBe(true);
  });

  it('resets submission guard after failure', async () => {
    const error = new axios.AxiosError('Network Error');
    (uploadMultipart as jest.Mock)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        data: { success: true, transaction: { id: 'txn-1' } },
      });

    await expect(submitTransaction(makeValidSubmission())).rejects.toThrow();

    // Should be able to submit again after failure
    const result = await submitTransaction(makeValidSubmission());
    expect(result.success).toBe(true);
  });
});
