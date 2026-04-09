// jest-expo automocks react-native; hook tests need it unmocked.
jest.unmock('react-native');

// Mock expo-constants so transitive loads of src/services/config.ts succeed
// without booting the native expo-constants module.
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    extra: { releaseChannel: 'development' },
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useApprovalAction } from '../hooks/useApprovalAction';
import * as transactionService from '../services/transactionService';
import { Transaction } from '../types';

jest.mock('../services/transactionService', () => {
  const actual = jest.requireActual('../services/transactionService');
  return {
    ...actual,
    updateApprovalStatus: jest.fn(),
  };
});

const mockUpdate = transactionService.updateApprovalStatus as jest.MockedFunction<
  typeof transactionService.updateApprovalStatus
>;

const baseTxn: Transaction = {
  id: 'txn-1',
  statement: 'Test',
  totalAmount: 100,
  currency: 'SAR',
  createdAt: '2025-01-01T00:00:00Z',
  approvalStatus: 'Pending',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useApprovalAction', () => {
  it('returns updated transaction on success', async () => {
    const updated = { ...baseTxn, approvalStatus: 'Approved' as const };
    mockUpdate.mockResolvedValue(updated);

    const { result } = renderHook(() => useApprovalAction());

    let returned: Transaction | null = null;
    await act(async () => {
      returned = await result.current.execute('txn-1', 'Approved');
    });

    expect(returned).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith('txn-1', 'Approved');
  });

  it('sets isUpdating during API call', async () => {
    let resolvePromise: (val: Transaction) => void;
    mockUpdate.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useApprovalAction());

    expect(result.current.isUpdating).toBe(false);

    let executePromise: Promise<Transaction | null>;
    act(() => {
      executePromise = result.current.execute('txn-1', 'Approved');
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(true);
    });

    await act(async () => {
      resolvePromise!({ ...baseTxn, approvalStatus: 'Approved' });
      await executePromise;
    });

    expect(result.current.isUpdating).toBe(false);
  });

  it('throws TransactionError on failure', async () => {
    mockUpdate.mockRejectedValue(
      new transactionService.TransactionError('FORBIDDEN'),
    );

    const { result } = renderHook(() => useApprovalAction());

    await expect(
      act(async () => {
        await result.current.execute('txn-1', 'Approved');
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
