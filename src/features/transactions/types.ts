/** Approval status values — the only valid values for the approvalStatus field */
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Tax quarter values */
export const TAX_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type TaxQuarter = (typeof TAX_QUARTERS)[number];

/** Tax year values */
export const TAX_YEARS = ['2024', '2025', '2026', '2027'] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

/** Pagination constants */
export const PAGE_SIZE = 20;

/** Max length for text filter inputs */
export const FILTER_MAX_LENGTH = 200;

/** Populated employee reference from backend */
export interface TransactionEmployee {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Populated client reference */
export interface TransactionClient {
  id: string;
  name: string;
}

/** Populated project reference */
export interface TransactionProject {
  id: string;
  name: string;
}

/** Receipt reference (display only — no download/edit in this phase) */
export interface TransactionReceipt {
  id: string;
  filename?: string;
  mimeType?: string;
  url?: string;
  thumbnailURL?: string;
}

/** Single transaction as returned by the list API */
export interface Transaction {
  id: string;
  statement: string;
  totalAmount: number;
  currency: string;
  tax?: string;
  bankFees?: number;
  transactionNumber?: string;
  transactionDate?: string;
  createdAt: string;
  approvalStatus: ApprovalStatus;
  partnerType?: 'employee' | 'wallet';
  partnerEmployee?: TransactionEmployee | string;
  otherParty?: string;
  client?: TransactionClient;
  project?: TransactionProject;
  recordedBy?: TransactionEmployee | string;
  expenseReceipts?: TransactionReceipt[];
  notes?: string;
}

/** Pagination metadata from the API */
export interface TransactionPagination {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Filter state passed to/from the search modal */
export interface TransactionFilters {
  statement: string;
  transactionNumber: string;
  partnerEmployee: string;
  otherParty: string;
  client: string;
  project: string;
  amountMin: string;
  amountMax: string;
  taxQuarter: TaxQuarter | null;
  taxYear: TaxYear | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  approvalStatus: ApprovalStatus | null;
}

/** Sentinel for empty filters */
export const EMPTY_FILTERS: TransactionFilters = {
  statement: '',
  transactionNumber: '',
  partnerEmployee: '',
  otherParty: '',
  client: '',
  project: '',
  amountMin: '',
  amountMax: '',
  taxQuarter: null,
  taxYear: null,
  dateFrom: null,
  dateTo: null,
  approvalStatus: null,
};
