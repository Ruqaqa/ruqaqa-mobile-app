import { apiClient } from '@/services/apiClient';
import { ApiError, mapAxiosError } from '@/services/errors';
import { formatDateParam } from '@/utils/formatters';
import {
  Reconciliation,
  ReconciliationPagination,
  ReconciliationFilters,
  ApprovalStatus,
  APPROVAL_STATUSES,
  PAGE_SIZE,
} from '../types';
import { sanitizeFilters } from '../utils/sanitize';

/** @deprecated Use ApiError from '@/services/errors' directly */
export { ApiError as ReconciliationError } from '@/services/errors';

interface FetchReconciliationsParams {
  page: number;
  showOwn: boolean;
  filters: ReconciliationFilters;
}

interface FetchReconciliationsResult {
  reconciliations: Reconciliation[];
  pagination: ReconciliationPagination;
}

export async function fetchReconciliations(
  params: FetchReconciliationsParams,
): Promise<FetchReconciliationsResult> {
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
  if (sanitized.reconciliationNumber) queryParams.reconciliationNumber = sanitized.reconciliationNumber;
  if (sanitized.fromEmployee) queryParams.fromEmployee = sanitized.fromEmployee;
  if (sanitized.toEmployee) queryParams.toEmployee = sanitized.toEmployee;
  if (sanitized.amountMin) queryParams.amountMin = sanitized.amountMin;
  if (sanitized.amountMax) queryParams.amountMax = sanitized.amountMax;
  if (sanitized.type) queryParams.type = sanitized.type;
  if (sanitized.fromType) queryParams.fromType = sanitized.fromType;
  if (sanitized.toType) queryParams.toType = sanitized.toType;
  if (sanitized.senderChannel) queryParams.senderChannel = sanitized.senderChannel;
  if (sanitized.receiverChannel) queryParams.receiverChannel = sanitized.receiverChannel;
  if (sanitized.approvalStatus) queryParams.approvalStatus = sanitized.approvalStatus;
  if (sanitized.dateFrom) queryParams.dateFrom = formatDateParam(sanitized.dateFrom);
  if (sanitized.dateTo) queryParams.dateTo = formatDateParam(sanitized.dateTo);

  try {
    const response = await apiClient.get('/reconciliation', { params: queryParams });
    const { reconciliation, pagination } = response.data.data;
    return { reconciliations: reconciliation, pagination };
  } catch (error) {
    throw mapAxiosError(error);
  }
}

/** The PATCH endpoint returns only the fields it updated, not the full record. */
export interface ApprovalStatusResult {
  id: string;
  approvalStatus: ApprovalStatus;
}

export async function updateApprovalStatus(
  recordId: string,
  status: ApprovalStatus,
): Promise<ApprovalStatusResult> {
  if (!(APPROVAL_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError('UNKNOWN', 'Invalid approval status');
  }

  try {
    const response = await apiClient.patch('/reconciliation', {
      recordId,
      approvalStatus: status,
    });
    return response.data.reconciliation;
  } catch (error) {
    throw mapAxiosError(error);
  }
}
