import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useReconciliationList } from '../hooks/useReconciliationList';
import * as reconciliationService from '../services/reconciliationService';
import { EMPTY_FILTERS, Reconciliation, ReconciliationPagination } from '../types';

jest.mock('../services/reconciliationService', () => {
  const actual = jest.requireActual('../services/reconciliationService');
  return {
    ...actual,
    fetchReconciliations: jest.fn(),
  };
});

const mockFetch = reconciliationService.fetchReconciliations as jest.MockedFunction<
  typeof reconciliationService.fetchReconciliations
>;

const makeRec = (id: string): Reconciliation => ({
  id,
  reconciliationNumber: `REC-${id}`,
  statement: `Statement ${id}`,
  approvalStatus: 'Pending',
  type: 'normal',
  totalAmount: 100,
  bankFees: null,
  bankFeesCurrency: null,
  currency: 'SAR',
  date: '2025-01-01',
  fromType: 'employee',
  fromEmployee: { id: 'emp-1', name: 'John' },
  senderChannel: { id: 'ch-1', name: 'Bank' },
  toType: 'employee',
  toEmployee: { id: 'emp-2', name: 'Jane' },
  receiverChannel: { id: 'ch-2', name: 'Cash' },
  notes: null,
  createdAt: '2025-01-01T00:00:00Z',
});

const makePagination = (
  overrides: Partial<ReconciliationPagination> = {},
): ReconciliationPagination => ({
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

describe('useReconciliationList', () => {
  it('fetches initial data on mount with showOwn=true', async () => {
    mockFetch.mockResolvedValue({
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.reconciliations).toHaveLength(1);
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
        reconciliations: [makeRec('1')],
        pagination: makePagination({ hasNextPage: true }),
      })
      .mockResolvedValueOnce({
        reconciliations: [makeRec('2')],
        pagination: makePagination({ page: 2, hasNextPage: false }),
      });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.reconciliations).toHaveLength(2);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore is no-op when hasMore is false', async () => {
    mockFetch.mockResolvedValue({
      reconciliations: [makeRec('1')],
      pagination: makePagination({ hasNextPage: false }),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockFetch.mock.calls.length;
    act(() => {
      result.current.loadMore();
    });

    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it('setShowOwn resets to page 1 and refetches', async () => {
    mockFetch.mockResolvedValue({
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
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
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = mockFetch.mock.calls.length;
    act(() => {
      result.current.setShowOwn(false);
    });

    expect(result.current.showOwn).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it('setFilters resets to page 1 and refetches', async () => {
    mockFetch.mockResolvedValue({
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
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
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
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
      reconciliations: [makeRec('1')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
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

  it('updateReconciliation replaces item in list', async () => {
    mockFetch.mockResolvedValue({
      reconciliations: [makeRec('1'), makeRec('2')],
      pagination: makePagination(),
    });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updated = { ...makeRec('1'), approvalStatus: 'Approved' as const };
    act(() => {
      result.current.updateReconciliation('1', updated);
    });

    expect(result.current.reconciliations[0].approvalStatus).toBe('Approved');
    expect(result.current.reconciliations[1].id).toBe('2');
  });

  it('sets error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(
      new reconciliationService.ReconciliationError('NETWORK'),
    );

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
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
        new reconciliationService.ReconciliationError('NETWORK'),
      )
      .mockResolvedValue({
        reconciliations: [makeRec('1')],
        pagination: makePagination(),
      });

    const { result } = renderHook(() =>
      useReconciliationList({ canViewAll: true }),
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.reconciliations).toHaveLength(1);
    });
  });
});
