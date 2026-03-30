import { APPROVAL_STATUSES, ApprovalStatus, PAGE_SIZE, FILTER_MAX_LENGTH } from '@/types/shared';
export { APPROVAL_STATUSES, ApprovalStatus, PAGE_SIZE, FILTER_MAX_LENGTH };

/** Tax quarter values */
export const TAX_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type TaxQuarter = (typeof TAX_QUARTERS)[number];

/** Tax year values */
export const TAX_YEARS = ['2024', '2025', '2026', '2027'] as const;
export type TaxYear = (typeof TAX_YEARS)[number];

/** Currency values accepted by the API */
export const CURRENCIES = ['ريال سعودي', 'دولار أمريكي'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Partner API-contract values — these are wire-format strings, not display labels */
export const WALLET_PARTNER = 'المحفظة' as const;
export const BALAD_CARD_PARTNER = 'بطاقة البلاد' as const;

/** Partner type values */
export const PARTNER_TYPES = ['employee', 'wallet'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

/** Max length for notes field */
export const NOTES_MAX_LENGTH = 1000;

/** Max file size for receipt uploads (10 MB) */
export const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024;

/** Max number of receipt files */
export const MAX_RECEIPTS = 4;

/** Allowed MIME types for receipt uploads */
export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
] as const;

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

/** Data shape for transaction creation submission */
export interface TransactionSubmissionData {
  statement: string;
  totalAmount: string;
  currency: string;
  tax: string;
  transactionDate: string;
  partnerEmployee: string | null;
  otherParty: string | null;
  otherPartyType: string | null;
  otherPartyId: string | null;
  client: string | null;
  project: string | null;
  notes: string | null;
  bankFees: string | null;
  bankFeesCurrency: string | null;
  receipts: File[];
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
