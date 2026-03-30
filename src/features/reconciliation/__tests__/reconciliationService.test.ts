import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  fetchReconciliations,
  updateApprovalStatus,
  ReconciliationError,
} from '../services/reconciliationService';
import { EMPTY_FILTERS, ReconciliationFilters } from '../types';

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

const mockReconciliation = {
  id: 'rec-1',
  reconciliationNumber: 'REC-001',
  statement: 'Office supplies',
  approvalStatus: 'Pending',
  type: 'normal',
  totalAmount: 500,
  bankFees: null,
  bankFeesCurrency: null,
  currency: 'SAR',
  date: '2025-03-01',
  fromType: 'employee',
  fromEmployee: { id: 'emp-1', name: 'John' },
  senderChannel: { id: 'ch-1', name: 'Bank Transfer' },
  toType: 'employee',
  toEmployee: { id: 'emp-2', name: 'Jane' },
  receiverChannel: { id: 'ch-2', name: 'Cash' },
  notes: null,
  createdAt: '2025-03-01T00:00:00Z',
};

describe('fetchReconciliations', () => {
  it('sends correct query params for page 1 with own=true', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [mockReconciliation], pagination: mockPagination },
    });

    await fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
    expect(params.own).toBe('true');
  });

  it('omits own param when showOwn is false', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    await fetchReconciliations({ page: 1, showOwn: false, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.own).toBeUndefined();
  });

  it('clamps page to minimum of 1', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    await fetchReconciliations({ page: -5, showOwn: true, filters: EMPTY_FILTERS });

    expect(mock.history.get[0].params.page).toBe(1);
  });

  it('floors fractional page numbers', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    await fetchReconciliations({ page: 2.7, showOwn: true, filters: EMPTY_FILTERS });

    expect(mock.history.get[0].params.page).toBe(2);
  });

  it('sends sanitized filter params', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      statement: '  rent  ',
      approvalStatus: 'Approved',
      amountMin: '500.50',
      amountMax: '1000',
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.statement).toBe('rent');
    expect(params.approvalStatus).toBe('Approved');
    expect(params.amountMin).toBe('500.50');
    expect(params.amountMax).toBe('1000');
  });

  it('sends type filter when set', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      type: 'salary',
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    expect(mock.history.get[0].params.type).toBe('salary');
  });

  it('sends fromEmployee and toEmployee filters', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'employee',
      fromEmployee: 'John',
      toType: 'employee',
      toEmployee: 'Jane',
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.fromEmployee).toBe('John');
    expect(params.toEmployee).toBe('Jane');
  });

  it('sends fromType and toType filters', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      fromType: 'employee',
      toType: 'المحفظة',
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.fromType).toBe('employee');
    expect(params.toType).toBe('المحفظة');
  });

  it('sends senderChannel and receiverChannel filters', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      senderChannel: '507f1f77bcf86cd799439011',
      receiverChannel: 'aabbccddeeff00112233aabb',
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.senderChannel).toBe('507f1f77bcf86cd799439011');
    expect(params.receiverChannel).toBe('aabbccddeeff00112233aabb');
  });

  it('omits empty filter fields from params', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    await fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS });

    const params = mock.history.get[0].params;
    expect(params.statement).toBeUndefined();
    expect(params.fromEmployee).toBeUndefined();
    expect(params.toEmployee).toBeUndefined();
    expect(params.fromType).toBeUndefined();
    expect(params.toType).toBeUndefined();
    expect(params.approvalStatus).toBeUndefined();
    expect(params.type).toBeUndefined();
    expect(params.senderChannel).toBeUndefined();
    expect(params.receiverChannel).toBeUndefined();
  });

  it('sends dateFrom and dateTo as YYYY-MM-DD', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [], pagination: mockPagination },
    });

    const filters: ReconciliationFilters = {
      ...EMPTY_FILTERS,
      dateFrom: new Date('2025-01-15T00:00:00Z'),
      dateTo: new Date('2025-03-20T00:00:00Z'),
    };

    await fetchReconciliations({ page: 1, showOwn: true, filters });

    const params = mock.history.get[0].params;
    expect(params.dateFrom).toBe('2025-01-15');
    expect(params.dateTo).toBe('2025-03-20');
  });

  it('returns reconciliations and pagination on success', async () => {
    mock.onGet('/reconciliation').reply(200, {
      success: true,
      data: { reconciliation: [mockReconciliation], pagination: mockPagination },
    });

    const result = await fetchReconciliations({
      page: 1,
      showOwn: true,
      filters: EMPTY_FILTERS,
    });

    expect(result.reconciliations).toHaveLength(1);
    expect(result.reconciliations[0].id).toBe('rec-1');
    expect(result.pagination.totalDocs).toBe(50);
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onGet('/reconciliation').reply(403, { error: 'Forbidden' });

    await expect(
      fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('throws NOT_FOUND on 404', async () => {
    mock.onGet('/reconciliation').reply(404);

    await expect(
      fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('throws SERVER on 500', async () => {
    mock.onGet('/reconciliation').reply(500);

    await expect(
      fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'SERVER' }));
  });

  it('throws NETWORK on network error', async () => {
    mock.onGet('/reconciliation').networkError();

    await expect(
      fetchReconciliations({ page: 1, showOwn: true, filters: EMPTY_FILTERS }),
    ).rejects.toThrow(expect.objectContaining({ code: 'NETWORK' }));
  });
});

describe('updateApprovalStatus', () => {
  it('sends PATCH with correct body and returns approval status result', async () => {
    mock.onPatch('/reconciliation').reply(200, {
      success: true,
      reconciliation: { id: 'rec-1', approvalStatus: 'Approved' },
    });

    const result = await updateApprovalStatus('rec-1', 'Approved');

    expect(result.id).toBe('rec-1');
    expect(result.approvalStatus).toBe('Approved');
    const body = JSON.parse(mock.history.patch[0].data);
    expect(body.recordId).toBe('rec-1');
    expect(body.approvalStatus).toBe('Approved');
  });

  it('throws FORBIDDEN on 403', async () => {
    mock.onPatch('/reconciliation').reply(403);

    await expect(updateApprovalStatus('rec-1', 'Approved')).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('rejects invalid approval status before sending', async () => {
    await expect(
      updateApprovalStatus('rec-1', 'InvalidStatus' as any),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNKNOWN' }));

    expect(mock.history.patch).toHaveLength(0);
  });
});
