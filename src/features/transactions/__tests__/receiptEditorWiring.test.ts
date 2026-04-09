// jest-expo automocks react-native; component/hook tests need it unmocked.
jest.unmock('react-native');

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios, uploadMultipart: jest.fn() };
});

jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy(
    {},
    {
      get: () => stub,
    },
  );
});

import { TransactionReceipt } from '../types';
import * as receiptService from '../services/receiptService';
import { ReceiptAttachment } from '../components/ReceiptPickerSection';
import {
  mapEditModeToEditorMode,
  createUploadHandler,
  createSaveCompleteHandler,
} from '../utils/receiptEditorHandlers';

jest.mock('../services/receiptService');

const mockUploadReceipt = receiptService.uploadReceipt as jest.MockedFunction<
  typeof receiptService.uploadReceipt
>;
const mockAddReceipts =
  receiptService.addReceiptsToTransaction as jest.MockedFunction<
    typeof receiptService.addReceiptsToTransaction
  >;
const mockUpdateReceipts =
  receiptService.updateTransactionReceipts as jest.MockedFunction<
    typeof receiptService.updateTransactionReceipts
  >;

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------------------------------------------
// mapEditModeToEditorMode
// -------------------------------------------------------

describe('mapEditModeToEditorMode', () => {
  it('maps full-edit to edit', () => {
    expect(mapEditModeToEditorMode('full-edit')).toBe('edit');
  });

  it('maps add-only to add', () => {
    expect(mapEditModeToEditorMode('add-only')).toBe('add');
  });
});

// -------------------------------------------------------
// createUploadHandler
// -------------------------------------------------------

describe('createUploadHandler', () => {
  const files: ReceiptAttachment[] = [
    { id: 'a1', uri: 'file:///img1.jpg', type: 'image', name: 'img1.jpg', mimeType: 'image/jpeg' },
    { id: 'a2', uri: 'file:///img2.jpg', type: 'image', name: 'img2.jpg', mimeType: 'image/jpeg' },
  ];

  it('uploads each file via receiptService.uploadReceipt and returns TransactionReceipt[]', async () => {
    mockUploadReceipt
      .mockResolvedValueOnce('receipt-id-1')
      .mockResolvedValueOnce('receipt-id-2');

    const handler = createUploadHandler();
    const result = await handler('txn-1', files);

    expect(mockUploadReceipt).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('receipt-id-1');
    expect(result[1].id).toBe('receipt-id-2');
  });

  it('propagates upload errors', async () => {
    mockUploadReceipt.mockRejectedValueOnce(new Error('Network error'));

    const handler = createUploadHandler();
    await expect(handler('txn-1', [files[0]])).rejects.toThrow('Network error');
  });
});

// -------------------------------------------------------
// createSaveCompleteHandler (add-only mode)
// -------------------------------------------------------

describe('createSaveCompleteHandler — add-only mode', () => {
  it('calls addReceiptsToTransaction with only new receipt IDs', async () => {
    mockAddReceipts.mockResolvedValueOnce(undefined);
    const onRefresh = jest.fn();

    const existingReceipts: TransactionReceipt[] = [
      { id: 'r-existing', filename: 'old.jpg' },
    ];
    const updatedReceipts: TransactionReceipt[] = [
      { id: 'r-existing', filename: 'old.jpg' },
      { id: 'r-new-1', filename: 'new1.jpg' },
      { id: 'r-new-2', filename: 'new2.jpg' },
    ];

    const handler = createSaveCompleteHandler({
      transactionId: 'txn-1',
      mode: 'add',
      existingReceiptIds: existingReceipts.map((r) => r.id),
      onRefresh,
    });

    await handler(updatedReceipts);

    expect(mockAddReceipts).toHaveBeenCalledWith('txn-1', ['r-new-1', 'r-new-2']);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('skips API call when no new receipts were added', async () => {
    const onRefresh = jest.fn();
    const receipts: TransactionReceipt[] = [
      { id: 'r-existing', filename: 'old.jpg' },
    ];

    const handler = createSaveCompleteHandler({
      transactionId: 'txn-1',
      mode: 'add',
      existingReceiptIds: ['r-existing'],
      onRefresh,
    });

    await handler(receipts);

    expect(mockAddReceipts).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
  });
});

// -------------------------------------------------------
// createSaveCompleteHandler (full-edit mode)
// -------------------------------------------------------

describe('createSaveCompleteHandler — full-edit mode', () => {
  it('calls updateTransactionReceipts with the full receipt ID list', async () => {
    mockUpdateReceipts.mockResolvedValueOnce(undefined);
    const onRefresh = jest.fn();

    const updatedReceipts: TransactionReceipt[] = [
      { id: 'r1', filename: 'kept.jpg' },
      { id: 'r-new', filename: 'new.jpg' },
    ];

    const handler = createSaveCompleteHandler({
      transactionId: 'txn-1',
      mode: 'edit',
      existingReceiptIds: ['r1', 'r2'],
      onRefresh,
    });

    await handler(updatedReceipts);

    expect(mockUpdateReceipts).toHaveBeenCalledWith('txn-1', ['r1', 'r-new']);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('calls onRefresh even when API call fails', async () => {
    mockUpdateReceipts.mockRejectedValueOnce(new Error('Server error'));
    const onRefresh = jest.fn();

    const handler = createSaveCompleteHandler({
      transactionId: 'txn-1',
      mode: 'edit',
      existingReceiptIds: ['r1'],
      onRefresh,
    });

    // Should not throw — errors are swallowed since modal is already closing
    await handler([{ id: 'r1', filename: 'kept.jpg' }]);

    expect(onRefresh).toHaveBeenCalled();
  });
});
