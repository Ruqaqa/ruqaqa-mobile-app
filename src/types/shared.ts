/** Approval status values — the only valid values for the approvalStatus field */
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Pagination constants */
export const PAGE_SIZE = 20;

/** Max length for text filter inputs */
export const FILTER_MAX_LENGTH = 200;
