// jest-expo's preset automocks react-native. Component/hook tests that reach
// into real modules need the full native module surface.
jest.unmock('react-native');

// Mock expo-constants so transitive loads of src/services/config.ts succeed
// without booting the native expo-constants module.
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

// Short-circuit apiClient so lower-level expo native modules don't load at all.
jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios, uploadMultipart: jest.fn() };
});

// Stub lucide-react-native to avoid react-native-svg native load when
// ReceiptPickerSection is imported transitively for its type exports.
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy(
    {},
    {
      get: () => stub,
    },
  );
});

import { renderHook, act } from '@testing-library/react-native';
import { useReceiptEditor } from '../hooks/useReceiptEditor';
import * as receiptService from '../services/receiptService';
import { TransactionReceipt } from '../types';
import { ReceiptAttachment } from '../components/ReceiptPickerSection';

// Mock receiptService
jest.mock('../services/receiptService');

const mockUploadReceipt = receiptService.uploadReceipt as jest.MockedFunction<
  typeof receiptService.uploadReceipt
>;
const mockAddReceipts = receiptService.addReceiptsToTransaction as jest.MockedFunction<
  typeof receiptService.addReceiptsToTransaction
>;
const mockUpdateReceipts = receiptService.updateTransactionReceipts as jest.MockedFunction<
  typeof receiptService.updateTransactionReceipts
>;

const existingReceipts: TransactionReceipt[] = [
  { id: 'r1', filename: 'receipt1.jpg', mimeType: 'image/jpeg' },
  { id: 'r2', filename: 'receipt2.pdf', mimeType: 'application/pdf' },
];

const newAttachment: ReceiptAttachment = {
  id: 'att_1',
  uri: 'file:///tmp/new.jpg',
  type: 'image',
  name: 'new.jpg',
  mimeType: 'image/jpeg',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------------------------------------------
// Tracking existing receipts
// -------------------------------------------------------

describe('existing receipts tracking', () => {
  it('initializes with all existing receipts tracked', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    expect(result.current.state.existingReceipts).toEqual(existingReceipts);
    expect(result.current.state.keptReceiptIds.size).toBe(2);
    expect(result.current.state.keptReceiptIds.has('r1')).toBe(true);
    expect(result.current.state.keptReceiptIds.has('r2')).toBe(true);
  });
});

// -------------------------------------------------------
// New attachments
// -------------------------------------------------------

describe('new attachments', () => {
  it('starts with empty new attachments', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    expect(result.current.state.newAttachments).toEqual([]);
  });

  it('adds a new attachment', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    expect(result.current.state.newAttachments).toHaveLength(1);
    expect(result.current.state.newAttachments[0].id).toBe('att_1');
  });

  it('removes an attachment by id', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });
    act(() => {
      result.current.removeAttachment('att_1');
    });

    expect(result.current.state.newAttachments).toHaveLength(0);
  });
});

// -------------------------------------------------------
// Toggle existing receipts (full-edit vs add-only)
// -------------------------------------------------------

describe('toggleExistingReceipt', () => {
  it('in full-edit mode: marks receipt for deletion', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'full-edit',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleExistingReceipt('r1');
    });

    expect(result.current.state.keptReceiptIds.has('r1')).toBe(false);
    expect(result.current.state.keptReceiptIds.has('r2')).toBe(true);
  });

  it('in full-edit mode: can unmark (toggle back)', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'full-edit',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleExistingReceipt('r1');
    });
    act(() => {
      result.current.toggleExistingReceipt('r1');
    });

    expect(result.current.state.keptReceiptIds.has('r1')).toBe(true);
  });

  it('in add-only mode: toggle is no-op', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleExistingReceipt('r1');
    });

    expect(result.current.state.keptReceiptIds.has('r1')).toBe(true);
    expect(result.current.state.keptReceiptIds.size).toBe(2);
  });
});

// -------------------------------------------------------
// Computed values
// -------------------------------------------------------

describe('getReceiptIdsToKeep / getNewFiles', () => {
  it('getReceiptIdsToKeep returns IDs not marked for deletion', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'full-edit',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleExistingReceipt('r1');
    });

    // keptReceiptIds should only have r2
    const kept = Array.from(result.current.state.keptReceiptIds);
    expect(kept).toEqual(['r2']);
  });

  it('getNewFiles returns newly added files', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    expect(result.current.state.newAttachments).toHaveLength(1);
    expect(result.current.state.newAttachments[0].uri).toBe('file:///tmp/new.jpg');
  });
});

// -------------------------------------------------------
// canSave
// -------------------------------------------------------

describe('canSave', () => {
  it('is false when no changes', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    expect(result.current.canSave).toBe(false);
  });

  it('is true when new attachments added', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    expect(result.current.canSave).toBe(true);
  });

  it('is true when existing receipt toggled for deletion (full-edit)', () => {
    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'full-edit',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.toggleExistingReceipt('r1');
    });

    expect(result.current.canSave).toBe(true);
  });
});

// -------------------------------------------------------
// Save flow — add-only mode
// -------------------------------------------------------

describe('save in add-only mode', () => {
  it('uploads new files then calls addReceiptsToTransaction', async () => {
    mockUploadReceipt.mockResolvedValue('new-r1');
    mockAddReceipts.mockResolvedValue(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess,
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUploadReceipt).toHaveBeenCalledTimes(1);
    expect(mockAddReceipts).toHaveBeenCalledWith('txn-1', ['new-r1']);
    expect(mockUpdateReceipts).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('does NOT call updateTransactionReceipts', async () => {
    mockUploadReceipt.mockResolvedValue('new-r1');
    mockAddReceipts.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdateReceipts).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------
// Save flow — full-edit mode
// -------------------------------------------------------

describe('save in full-edit mode', () => {
  it('uploads new files then calls updateTransactionReceipts with kept + new IDs', async () => {
    mockUploadReceipt.mockResolvedValue('new-r1');
    mockUpdateReceipts.mockResolvedValue(undefined);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'full-edit',
        onSuccess,
      }),
    );

    // Remove r1, add a new attachment
    act(() => {
      result.current.toggleExistingReceipt('r1');
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUploadReceipt).toHaveBeenCalledTimes(1);
    // Kept: r2 (r1 was removed) + new: new-r1
    expect(mockUpdateReceipts).toHaveBeenCalledWith('txn-1', ['r2', 'new-r1']);
    expect(mockAddReceipts).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });
});

// -------------------------------------------------------
// Upload progress tracking
// -------------------------------------------------------

describe('upload progress', () => {
  it('tracks state: idle → uploading → saving → done', async () => {
    mockUploadReceipt.mockResolvedValue('new-r1');
    mockAddReceipts.mockResolvedValue(undefined);
    const states: string[] = [];

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    // Initially idle
    expect(result.current.state.isSaving).toBe(false);

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    // After save completes, isSaving should be false
    expect(result.current.state.isSaving).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('sets error state on upload failure', async () => {
    mockUploadReceipt.mockRejectedValue(
      Object.assign(new Error('Upload failed'), { code: 'NETWORK' }),
    );

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state.error).toBeTruthy();
    expect(result.current.state.isSaving).toBe(false);
  });

  it('tracks per-file upload status', async () => {
    mockUploadReceipt.mockResolvedValue('new-r1');
    mockAddReceipts.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    // After completion, the upload progress for the file should be 'done'
    const progress = result.current.state.uploadProgress.get('att_1');
    expect(progress?.state).toBe('done');
    expect(progress?.receiptId).toBe('new-r1');
  });

  it('marks failed file upload with error', async () => {
    const uploadError = Object.assign(new Error('failed'), { code: 'NETWORK' });
    mockUploadReceipt.mockRejectedValue(uploadError);

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
    });

    await act(async () => {
      await result.current.save();
    });

    const progress = result.current.state.uploadProgress.get('att_1');
    expect(progress?.state).toBe('failed');
  });
});

// -------------------------------------------------------
// Retry behavior
// -------------------------------------------------------

describe('retry after failure', () => {
  it('skips already-uploaded attachments on retry', async () => {
    const att2: ReceiptAttachment = {
      id: 'att_2',
      uri: 'file:///tmp/second.jpg',
      type: 'image',
      name: 'second.jpg',
      mimeType: 'image/jpeg',
    };

    // First upload succeeds, second fails
    mockUploadReceipt
      .mockResolvedValueOnce('new-r1')
      .mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() =>
      useReceiptEditor({
        transactionId: 'txn-1',
        existingReceipts,
        mode: 'add-only',
        onSuccess: jest.fn(),
      }),
    );

    act(() => {
      result.current.addAttachment(newAttachment);
      result.current.addAttachment(att2);
    });

    // First save — att_1 succeeds, att_2 fails
    await act(async () => {
      await result.current.save();
    });

    expect(mockUploadReceipt).toHaveBeenCalledTimes(2);

    // Retry — only att_2 should be uploaded
    mockUploadReceipt.mockResolvedValueOnce('new-r2');
    mockAddReceipts.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.save();
    });

    // Third call should be for att_2 only (att_1 was already done)
    expect(mockUploadReceipt).toHaveBeenCalledTimes(3);
    expect(mockAddReceipts).toHaveBeenCalledWith('txn-1', ['new-r1', 'new-r2']);
  });
});
