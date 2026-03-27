import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  fetchTransactions,
  fetchTransactionById,
  updateApprovalStatus,
  TransactionError,
} from '../services/transactionService';
import { EMPTY_FILTERS, TransactionFilters } from '../types';

// Mock the apiClient module
jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
});

afterEach(() => {
  mock.restore();
});

const mockPagination = {
  page: 1,
  limit: 20,
  totalDocs: 50,
  totalPages: 3,
  hasNextPage: true,
  hasPrevPage: false,
};

const mockTransaction = {
  id: 'txn-1',
  statement: 'Office supplies',
  totalAmount: 500,
  currency: 'SAR',
  createdAt: '2025-03-01T00:00:00Z',
  approvalStatus: 'Pending',
};

describe('fetchTransactions', () => {
  it('sends correct query params for page 1 with own=true', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [mockTransaction], pagination: mockPagination },
    });

    await fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
    expect(params.own).toBe('true');
  });

  it('omits own param when showOwn is false', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: 1, showOwn: false, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.own).toBeUndefined();
  });

  it('clamps page to minimum of 1', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: -5, showOwn: true, filters: EMPTY_FILTERS });

    expect(mock.history.get[0].params.page).toBe(1);
  });

  it('floors fractional page numbers', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: 2.7, showOwn: true, filters: EMPTY_FILTERS });

    expect(mock.history.get[0].params.page).toBe(2);
  });

  it('sends sanitized filter params', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      statement: '  rent  ',
      approvalStatus: 'Approved',
      amountMin: '100',
      amountMax: '500.50',
    };

    await fetchTransactions({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.statement).toBe('rent');
    expect(params.approvalStatus).toBe('Approved');
    expect(params.amountMin).toBe('100');
    expect(params.amountMax).toBe('500.50');
  });

  it('sends partnerEmployee query param when set', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      partnerEmployee: 'John',
    };

    await fetchTransactions({ page: 1, showOwn: true, filters });

    expect(mock.history.get[0].params.partnerEmployee).toBe('John');
  });

  it('sends otherParty query param when set', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      otherParty: 'Vendor Corp',
    };

    await fetchTransactions({ page: 1, showOwn: true, filters });

    expect(mock.history.get[0].params.otherParty).toBe('Vendor Corp');
  });

  it('does not send amountSign query param', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    expect(mock.history.get[0].params.amountSign).toBeUndefined();
  });

  it('sends taxQuarter and taxYear when set', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({
      page: 1,
      showOwn: true,
      filters: { ...EMPTY_FILTERS, taxQuarter: 'Q1', taxYear: '2025' },
    });

    const params = mock.history.get[0].params;
    expect(params.taxQuarter).toBe('Q1');
    expect(params.taxYear).toBe('2025');
  });

  it('omits taxQuarter and taxYear when null', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.taxQuarter).toBeUndefined();
    expect(params.taxYear).toBeUndefined();
  });

  it('omits empty filter fields from params', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    await fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.statement).toBeUndefined();
    expect(params.client).toBeUndefined();
    expect(params.approvalStatus).toBeUndefined();
  });

  it('sends dateFrom and dateTo as YYYY-MM-DD', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      dateFrom: new Date('2025-01-15T00:00:00Z'),
      dateTo: new Date('2025-03-20T00:00:00Z'),
    };

    await fetchTransactions({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.dateFrom).toBe('2025-01-15');
    expect(params.dateTo).toBe('2025-03-20');
  });

  it('drops invalid approvalStatus from filters', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [], pagination: mockPagination },
    });

    const filters: TransactionFilters = {
      ...EMPTY_FILTERS,
      approvalStatus: 'BadValue' as any,
    };

    await fetchTransactions({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.approvalStatus).toBeUndefined();
  });

  it('returns transactions and pagination on success', async () => {
    mock.onGet('/transactions').reply(200, {
      success: true,
      data: { transactions: [mockTransaction], pagination: mockPagination },
    });

    const result = await fetchTransactions({
      page: 1,
      showOwn: true,
      filters: EMPTY_FILTERS,
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe('txn-1');
    expect(result.pagination.totalDocs).toBe(50);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onGet('/transactions').reply(403, { error: 'Forbidden' });

    await expect(
      fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onGet('/transactions').reply(404);

    await expect(
      fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('throws SERVER on 500', async () => {
    mock.onGet('/transactions').reply(500);

    await expect(
      fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'SERVER' }));
  });

  it('throws NETWORK on network error', async () => {
    mock.onGet('/transactions').networkError();

    await expect(
      fetchTransactions({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'NETWORK' }));
  });
});

describe('fetchTransactionById', () => {
  it('fetches a single transaction', async () => {
    mock.onGet('/transactions/txn-1').reply(200, {
      success: true,
      data: mockTransaction,
    });

    const result = await fetchTransactionById('txn-1');
    expect(result.id).toBe('txn-1');
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onGet('/transactions/missing').reply(404);

    await expect(fetchTransactionById('missing')).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });
});

describe('updateApprovalStatus', () => {
  it('sends PATCH with correct body', async () => {
    mock.onPatch('/transactions').reply(200, {
      success: true,
      transaction: { id: 'txn-1', approvalStatus: 'Approved' },
    });
    // After PATCH, the service fetches the full transaction
    mock.onGet('/transactions/txn-1').reply(200, {
      success: true,
      data: { ...mockTransaction, approvalStatus: 'Approved' },
    });

    const result = await updateApprovalStatus('txn-1', 'Approved');

    expect(result.approvalStatus).toBe('Approved');
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.recordId).toBe('txn-1');
    expect(body.approvalStatus).toBe('Approved');
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPatch('/transactions').reply(403);

    await expect(updateApprovalStatus('txn-1', 'Approved')).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('rejects invalid approval status before sending', async () => {
    await expect(
      updateApprovalStatus('txn-1', 'InvalidStatus' as any),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNKNOWN' }));

    // Should not have made any network request
    expect(mock.history.patch).toHaveLength(0);
  });
});
