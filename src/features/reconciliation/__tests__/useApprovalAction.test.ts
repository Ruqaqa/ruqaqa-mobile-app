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
import * as reconciliationService from '../services/reconciliationService';
import { ApprovalStatusResult } from '../services/reconciliationService';

jest.mock('../services/reconciliationService', () => {
  const actual = jest.requireActual('../services/reconciliationService');
  return {
    ...actual,
    updateApprovalStatus: jest.fn(),
  };
});

const mockUpdate = reconciliationService.updateApprovalStatus as jest.MockedFunction<
  typeof reconciliationService.updateApprovalStatus
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useApprovalAction', () => {
  it('returns approval status result on success', async () => {
    const updated: ApprovalStatusResult = { id: 'rec-1', approvalStatus: 'Approved' };
    mockUpdate.mockResolvedValue(updated);

    const { result } = renderHook(() => useApprovalAction());

    let returned: ApprovalStatusResult | null = null;
    await act(async () => {
      returned = await result.current.execute('rec-1', 'Approved');
    });

    expect(returned).toEqual(updated);
    expect(mockUpdate).toHaveBeenCalledWith('rec-1', 'Approved');
  });

  it('sets isUpdating during API call', async () => {
    let resolvePromise: (val: ApprovalStatusResult) => void;
    mockUpdate.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useApprovalAction());

    expect(result.current.isUpdating).toBe(false);

    let executePromise: Promise<ApprovalStatusResult | null>;
    act(() => {
      executePromise = result.current.execute('rec-1', 'Approved');
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(true);
    });

    await act(async () => {
      resolvePromise!({ id: 'rec-1', approvalStatus: 'Approved' });
      await executePromise;
    });

    expect(result.current.isUpdating).toBe(false);
  });

  it('throws ReconciliationError on failure', async () => {
    mockUpdate.mockRejectedValue(
      new reconciliationService.ReconciliationError('FORBIDDEN'),
    );

    const { result } = renderHook(() => useApprovalAction());

    await expect(
      act(async () => {
        await result.current.execute('rec-1', 'Approved');
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
