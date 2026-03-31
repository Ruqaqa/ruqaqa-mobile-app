/** Approval status values — the only valid values for the approvalStatus field */
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Currency values accepted by the API */
export const CURRENCIES = ['ريال سعودي', 'دولار أمريكي'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Max length for notes field */
export const NOTES_MAX_LENGTH = 1000;

/** Pagination constants */
export const PAGE_SIZE = 20;

/** Max length for text filter inputs */
export const FILTER_MAX_LENGTH = 200;
