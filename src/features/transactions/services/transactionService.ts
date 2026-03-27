import { AxiosError } from 'axios';
import { apiClient } from '@/services/apiClient';
import {
  Transaction,
  TransactionPagination,
  TransactionFilters,
  ApprovalStatus,
  APPROVAL_STATUSES,
  PAGE_SIZE,
} from '../types';
import { sanitizeFilters } from '../utils/sanitize';

export class TransactionError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NOT_FOUND' | 'NETWORK' | 'SERVER' | 'UNKNOWN',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'TransactionError';
  }
}

interface FetchTransactionsParams {
  page: number;
  showOwn: boolean;
  filters: TransactionFilters;
}

interface FetchTransactionsResult {
  transactions: Transaction[];
  pagination: TransactionPagination;
}

function mapError(error: unknown): TransactionError {
  if (error instanceof TransactionError) return error;

  if (error instanceof AxiosError) {
    if (!error.response) return new TransactionError('NETWORK');
    const status = error.response.status;
    if (status === 403) return new TransactionError('FORBIDDEN');
    if (status === 404) return new TransactionError('NOT_FOUND');
    if (status >= 500) return new TransactionError('SERVER');
  }

  return new TransactionError('UNKNOWN');
}

function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function fetchTransactions(
  params: FetchTransactionsParams,
): Promise<FetchTransactionsResult> {
  const page = Math.max(1, Math.floor(params.page));
  const sanitized = sanitizeFilters(params.filters);

  const queryParams: Record<string, any> = {
    page,
    limit: PAGE_SIZE,
  };

  if (params.showOwn) {
    queryParams.own = 'true';
  }

  if (sanitized.statement) queryParams.statement = sanitized.statement;
  if (sanitized.transactionNumber) queryParams.transactionNumber = sanitized.transactionNumber;
  if (sanitized.partnerEmployee) queryParams.partnerEmployee = sanitized.partnerEmployee;
  if (sanitized.otherParty) queryParams.otherParty = sanitized.otherParty;
  if (sanitized.client) queryParams.client = sanitized.client;
  if (sanitized.project) queryParams.project = sanitized.project;
  if (sanitized.amountMin) queryParams.amountMin = sanitized.amountMin;
  if (sanitized.amountMax) queryParams.amountMax = sanitized.amountMax;
  if (sanitized.taxQuarter) queryParams.taxQuarter = sanitized.taxQuarter;
  if (sanitized.taxYear) queryParams.taxYear = sanitized.taxYear;
  if (sanitized.approvalStatus) queryParams.approvalStatus = sanitized.approvalStatus;
  if (sanitized.dateFrom) queryParams.dateFrom = formatDateParam(sanitized.dateFrom);
  if (sanitized.dateTo) queryParams.dateTo = formatDateParam(sanitized.dateTo);

  try {
    const response = await apiClient.get('/transactions', { params: queryParams });
    const { transactions, pagination } = response.data.data;
    return { transactions, pagination };
  } catch (error) {
    throw mapError(error);
  }
}

export async function fetchTransactionById(
  id: string,
): Promise<Transaction> {
  try {
    const response = await apiClient.get(`/transactions/${id}`);
    return response.data.data;
  } catch (error) {
    throw mapError(error);
  }
}

export async function updateApprovalStatus(
  recordId: string,
  status: ApprovalStatus,
): Promise<Transaction> {
  if (!(APPROVAL_STATUSES as readonly string[]).includes(status)) {
    throw new TransactionError('UNKNOWN', 'Invalid approval status');
  }

  try {
    const response = await apiClient.patch('/transactions', {
      recordId,
      approvalStatus: status,
    });
    // Backend returns { success, transaction: { id, approvalStatus } }
    // Fetch the full transaction to get all fields for the list update
    const updated = await fetchTransactionById(recordId);
    return updated;
  } catch (error) {
    throw mapError(error);
  }
}
