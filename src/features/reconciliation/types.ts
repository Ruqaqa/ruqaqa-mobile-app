import { APPROVAL_STATUSES, ApprovalStatus, PAGE_SIZE, FILTER_MAX_LENGTH } from '@/types/shared';
export { APPROVAL_STATUSES, ApprovalStatus, PAGE_SIZE, FILTER_MAX_LENGTH };

export const RECONCILIATION_TYPES = ['salary', 'bonus', 'normal'] as const;
export type ReconciliationType = (typeof RECONCILIATION_TYPES)[number];

export interface ReconciliationEmployee {
  id: string;
  name: string | null;
}

export interface ReconciliationChannel {
  id: string;
  name: string | null;
}

export interface Reconciliation {
  id: string;
  reconciliationNumber: string;
  statement: string;
  approvalStatus: ApprovalStatus;
  type: ReconciliationType | string;
  totalAmount: number;
  bankFees: number | null;
  bankFeesCurrency: string | null;
  currency: string;
  date: string | null;
  fromType: string | null;
  fromEmployee: ReconciliationEmployee | null;
  senderChannel: ReconciliationChannel | null;
  toType: string | null;
  toEmployee: ReconciliationEmployee | null;
  receiverChannel: ReconciliationChannel | null;
  notes: string | null;
  createdAt: string;
}

export interface ReconciliationPagination {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ReconciliationFilters {
  statement: string;
  reconciliationNumber: string;
  employee: string;
  amount: string;
  type: ReconciliationType | null;
  senderChannel: string;
  receiverChannel: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  approvalStatus: ApprovalStatus | null;
}

export const EMPTY_FILTERS: ReconciliationFilters = {
  statement: '',
  reconciliationNumber: '',
  employee: '',
  amount: '',
  type: null,
  senderChannel: '',
  receiverChannel: '',
  dateFrom: null,
  dateTo: null,
  approvalStatus: null,
};
