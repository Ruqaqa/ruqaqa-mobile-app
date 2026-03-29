import MockAdapter from 'axios-mock-adapter';
import { apiClient, uploadMultipart } from '@/services/apiClient';

// Mock the apiClient module
jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return {
    apiClient: mockAxios,
    uploadMultipart: jest.fn(),
  };
});

import {
  uploadReceipt,
  addReceiptsToTransaction,
  updateTransactionReceipts,
  ReceiptUploadError,
} from '../receiptService';

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
  (uploadMultipart as jest.Mock).mockReset();
});

afterEach(() => {
  mock.restore();
});

describe('uploadReceipt', () => {
  const attachment = {
    id: 'att_1',
    uri: 'file:///tmp/photo.jpg',
    type: 'image' as const,
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
  };

  it('calls uploadMultipart with correct path and FormData', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValue({
      data: { success: true, receiptId: 'receipt-123' },
    });

    await uploadReceipt(attachment);

    expect(uploadMultipart).toHaveBeenCalledTimes(1);
    const [path, formData, onProgress] = (uploadMultipart as jest.Mock).mock.calls[0];
    expect(path).toBe('/receipts/upload');
    expect(formData).toBeInstanceOf(FormData);
  });

  it('returns receiptId on success', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValue({
      data: { success: true, receiptId: 'receipt-456' },
    });

    const result = await uploadReceipt(attachment);
    expect(result).toBe('receipt-456');
  });

  it('passes onProgress callback to uploadMultipart', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValue({
      data: { success: true, receiptId: 'receipt-789' },
    });

    const onProgress = jest.fn();
    await uploadReceipt(attachment, onProgress);

    expect((uploadMultipart as jest.Mock).mock.calls[0][2]).toBe(onProgress);
  });

  it('throws NETWORK error on network failure', async () => {
    (uploadMultipart as jest.Mock).mockRejectedValue(
      createAxiosError(null, null),
    );

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'NETWORK' }),
    );
  });

  it('throws FORBIDDEN error on 403', async () => {
    (uploadMultipart as jest.Mock).mockRejectedValue(
      createAxiosError(403),
    );

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws SERVER error on 500', async () => {
    (uploadMultipart as jest.Mock).mockRejectedValue(
      createAxiosError(500),
    );

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    );
  });

  it('throws INVALID_FILE error on 400 with INVALID_FILE_TYPE code', async () => {
    (uploadMultipart as jest.Mock).mockRejectedValue(
      createAxiosError(400, { error: { code: 'INVALID_FILE_TYPE' } }),
    );

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'INVALID_FILE' }),
    );
  });

  it('throws FILE_TOO_LARGE error on 400 with FILE_TOO_LARGE code', async () => {
    (uploadMultipart as jest.Mock).mockRejectedValue(
      createAxiosError(400, { error: { code: 'FILE_TOO_LARGE' } }),
    );

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    );
  });

  it('throws UNKNOWN error on unexpected response', async () => {
    (uploadMultipart as jest.Mock).mockResolvedValue({
      data: { success: false },
    });

    await expect(uploadReceipt(attachment)).rejects.toThrow(
      expect.objectContaining({ code: 'UNKNOWN' }),
    );
  });
});

describe('addReceiptsToTransaction', () => {
  it('sends POST to /transactions/add-receipts with correct body', async () => {
    mock.onPost('/transactions/add-receipts').reply(200, {
      success: true,
      data: { transaction: {}, addedCount: 2 },
    });

    await addReceiptsToTransaction('txn-1', ['r1', 'r2']);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.transactionId).toBe('txn-1');
    expect(body.newReceiptIds).toEqual(['r1', 'r2']);
  });

  it('resolves on success', async () => {
    mock.onPost('/transactions/add-receipts').reply(200, {
      success: true,
      data: { transaction: {}, addedCount: 1 },
    });

    await expect(
      addReceiptsToTransaction('txn-1', ['r1']),
    ).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPost('/transactions/add-receipts').reply(403, {
      success: false,
      error: { code: 'PERMISSION_DENIED' },
    });

    await expect(
      addReceiptsToTransaction('txn-1', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onPost('/transactions/add-receipts').reply(404, {
      success: false,
      error: { code: 'TRANSACTION_NOT_FOUND' },
    });

    await expect(
      addReceiptsToTransaction('txn-1', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('throws SERVER on 500', async () => {
    mock.onPost('/transactions/add-receipts').reply(500);

    await expect(
      addReceiptsToTransaction('txn-1', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'SERVER' }));
  });

  it('throws NETWORK on network error', async () => {
    mock.onPost('/transactions/add-receipts').networkError();

    await expect(
      addReceiptsToTransaction('txn-1', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'NETWORK' }));
  });
});

describe('updateTransactionReceipts', () => {
  it('sends PUT to /transactions with transactionId and receiptIds', async () => {
    mock.onPut('/transactions').reply(200, { success: true });

    await updateTransactionReceipts('txn-2', ['r1', 'r3', 'r4']);

    const body = JSON.parse(mock.history.put[0].data);
    expect(body.transactionId).toBe('txn-2');
    expect(body.receiptIds).toEqual(['r1', 'r3', 'r4']);
  });

  it('resolves on success', async () => {
    mock.onPut('/transactions').reply(200, { success: true });

    await expect(
      updateTransactionReceipts('txn-2', ['r1']),
    ).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPut('/transactions').reply(403);

    await expect(
      updateTransactionReceipts('txn-2', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('throws SERVER on 500', async () => {
    mock.onPut('/transactions').reply(500);

    await expect(
      updateTransactionReceipts('txn-2', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'SERVER' }));
  });

  it('throws NETWORK on network error', async () => {
    mock.onPut('/transactions').networkError();

    await expect(
      updateTransactionReceipts('txn-2', ['r1']),
    ).rejects.toThrow(expect.objectContaining({ code: 'NETWORK' }));
  });
});

// --- Helper ---

function createAxiosError(
  status: number | null,
  data?: any,
): any {
  const error: any = new Error('Request failed');
  error.isAxiosError = true;
  if (status !== null) {
    error.response = { status, data: data ?? {} };
  }
  // No response = network error
  return error;
}
