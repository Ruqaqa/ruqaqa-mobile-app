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
import { useTransactionList } from '../hooks/useTransactionList';
import * as transactionService from '../services/transactionService';
import { EMPTY_FILTERS, Transaction, TransactionPagination } from '../types';

jest.mock('../services/transactionService', () => {
  const actual = jest.requireActual('../services/transactionService');
  return {
    ...actual,
    fetchTransactions: jest.fn(),
  };
});

const mockFetch = transactionService.fetchTransactions as jest.MockedFunction<
  typeof transactionService.fetchTransactions
>;

const makeTxn = (id: string): Transaction => ({
  id,
  statement: `Statement ${id}`,
  totalAmount: 100,
  currency: 'SAR',
  createdAt: '2025-01-01T00:00:00Z',
  approvalStatus: 'Pending',
});

const makePagination = (
  overrides: Partial<TransactionPagination> = {},
): TransactionPagination => ({
  page: 1,
  limit: 20,
  totalDocs: 40,
  totalPages: 2,
  hasNextPage: true,
  hasPrevPage: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTransactionList', () => {
  it('fetches initial data on mount with showOwn=true', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.showOwn).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith({
      page: 1,
      showOwn: true,
      filters: EMPTY_FILTERS,
    });
  });

  it('loadMore appends next page of results', async () => {
    mockFetch
      .mockResolvedValueOnce({
        transactions: [makeTxn('1')],
        pagination: makePagination({ hasNextPage: true }),
      })
      .mockResolvedValueOnce({
        transactions: [makeTxn('2')],
        pagination: makePagination({ page: 2, hasNextPage: false }),
      });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.transactions).toHaveLength(2);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore is no-op when hasMore is false', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination({ hasNextPage: false }),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockFetch.mock.calls.length;
    act(() => {
      result.current.loadMore();
    });

    // No additional calls
    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it('setShowOwn resets to page 1 and refetches', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setShowOwn(false);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, showOwn: false }),
      );
    });
  });

  it('setShowOwn is no-op when canViewAll is false', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockFetch.mock.calls.length;
    act(() => {
      result.current.setShowOwn(false);
    });

    // showOwn should still be true
    expect(result.current.showOwn).toBe(true);
    // No additional call
    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it('setFilters resets to page 1 and refetches', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ ...EMPTY_FILTERS, statement: 'rent' });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({ statement: 'rent' }),
        }),
      );
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearFilters resets filters and refetches', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ ...EMPTY_FILTERS, statement: 'rent' });
    });

    await waitFor(() => expect(result.current.hasActiveFilters).toBe(true));

    act(() => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  it('refresh resets to page 1 and keeps filters', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ ...EMPTY_FILTERS, statement: 'rent' });
    });

    await waitFor(() => expect(result.current.hasActiveFilters).toBe(true));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({ statement: 'rent' }),
        }),
      );
    });
  });

  it('updateTransaction replaces item in list', async () => {
    mockFetch.mockResolvedValue({
      transactions: [makeTxn('1'), makeTxn('2')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updated = { ...makeTxn('1'), approvalStatus: 'Approved' as const };
    act(() => {
      result.current.updateTransaction('1', updated);
    });

    expect(result.current.transactions[0].approvalStatus).toBe('Approved');
    expect(result.current.transactions[1].id).toBe('2');
  });

  it('sets error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(
      new transactionService.TransactionError('NETWORK'),
    );

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.code).toBe('NETWORK');
  });

  it('retry refetches after error', async () => {
    mockFetch
      .mockRejectedValueOnce(
        new transactionService.TransactionError('NETWORK'),
      )
      .mockResolvedValue({
        transactions: [makeTxn('1')],
        pagination: makePagination(),
      });

    const { result } = renderHook(() =>
      useTransactionList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.transactions).toHaveLength(1);
    });
  });
});
