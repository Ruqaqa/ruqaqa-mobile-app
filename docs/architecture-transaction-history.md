# Transaction History — Final Architecture

> This is the implementation blueprint for the TDD engineer. Every file, interface, hook, and component is specified. Build exactly what is listed. Do not add features not described here.

---

## Scope

**In scope (this document):**
- Transaction history list with pagination
- Search/filter modal
- Mine/All toggle
- Transaction detail bottom sheet
- Approval status updates
- Receipt thumbnail viewing (display only)

**Out of scope (later phases):**
- Transaction creation form
- Receipt upload/editing/download
- Share intent receipt attachment
- Receipt editor page (add/remove receipts)
- Autocomplete fields (client, project, employee search-as-you-type)
- Sound feedback
- Employee cache service
- Form cache service

---

## API Contract

Source of truth: Flutter's `TransactionApiService` at `../finance_mobile/lib/features/transactions/services/transaction_api_service.dart`.

### GET /transactions

Query params sent by the client:

```
page: number          // starts at 1, increments by 1
limit: 20             // HARDCODED constant, never user-controlled
own: 'true'           // sent when showing own transactions; omitted for all
statement?: string    // trimmed, max 200 chars
transactionNumber?: string
client?: string       // trimmed, max 200 chars
project?: string      // trimmed, max 200 chars
dateFrom?: string     // YYYY-MM-DD
dateTo?: string       // YYYY-MM-DD
amount?: string       // numeric string only
approvalStatus?: 'Pending' | 'Approved' | 'Rejected'
```

Response shape:

```typescript
{
  success: boolean;
  data: {
    transactions: Transaction[];
    pagination: {
      page: number;
      limit: number;
      totalDocs: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}
```

### GET /transactions/:id

Returns a single transaction with full depth. Used after approval status change to refresh data.

### PATCH /transactions

Updates approval status:

```typescript
{ recordId: string; approvalStatus: 'Pending' | 'Approved' | 'Rejected' }
```

---

## TypeScript Interfaces

All in `src/features/transactions/types.ts`:

```typescript
/** Approval status values — the only valid values for the approvalStatus field */
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

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
  client: string;
  project: string;
  amount: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  approvalStatus: ApprovalStatus | null;
}

/** Sentinel for empty filters */
export const EMPTY_FILTERS: TransactionFilters = {
  statement: '',
  transactionNumber: '',
  client: '',
  project: '',
  amount: '',
  dateFrom: null,
  dateTo: null,
  approvalStatus: null,
};
```

### Security notes on types

- `Transaction` types only the fields we display. The backend returns more (depth: 2). We do not type or store the extra fields.
- `approvalStatus` is typed as a union, not a free string. The service layer validates against `APPROVAL_STATUSES` before sending.
- `PAGE_SIZE` is a constant. It is never derived from any user input or API response.
- Filter text fields are trimmed and capped at `FILTER_MAX_LENGTH` in the sanitization utility.

---

## File Structure

```
src/features/transactions/
  types.ts                          # Interfaces, constants, APPROVAL_STATUSES
  utils/
    sanitize.ts                     # sanitizeFilters(), sanitizeText(), isValidAmount()
    formatters.ts                   # formatDate(), formatAmount(), getAmountColor(),
                                    #   getPartnerDisplay(), getEmployeeDisplay()
  services/
    transactionService.ts           # fetchTransactions(), fetchTransactionById(),
                                    #   updateApprovalStatus()
  hooks/
    useTransactionList.ts           # Pagination, filters, own/all toggle, refresh
    useApprovalAction.ts            # Confirmation + loading + API call + error
  components/
    TransactionHistoryScreen.tsx    # Orchestrator: filter bar + list + sheets
    FilterBar.tsx                   # Compact bar: search icon + segmented control + clear
    TransactionCard.tsx             # Single card in the list
    TransactionList.tsx             # FlatList with pull-to-refresh + load more
    SearchModal.tsx                 # Bottom sheet with all filter inputs
    TransactionDetailSheet.tsx      # Draggable bottom sheet with full details
    TransactionFlowWidget.tsx       # [Partner] -> [Other Party] visual
    ApprovalActions.tsx             # Approve/Reject/Pending buttons with confirmation
    ReceiptThumbnails.tsx           # Horizontal scroll of receipt thumbnails
  __tests__/
    sanitize.test.ts
    formatters.test.ts
    transactionService.test.ts
    useTransactionList.test.ts
    useApprovalAction.test.ts

src/components/ui/
  SegmentedControl.tsx              # New reusable component
  SkeletonCard.tsx                  # New reusable component
  EmptyState.tsx                    # New reusable component
  ErrorState.tsx                    # New reusable component
  DatePickerField.tsx               # New reusable component
```

---

## Service Layer

### `transactionService.ts`

```typescript
import { apiClient } from '@/services/apiClient';
import {
  Transaction, TransactionPagination, TransactionFilters,
  ApprovalStatus, APPROVAL_STATUSES, PAGE_SIZE,
} from '../types';
import { sanitizeFilters } from '../utils/sanitize';

interface FetchTransactionsParams {
  page: number;
  showOwn: boolean;
  filters: TransactionFilters;
}

interface FetchTransactionsResult {
  transactions: Transaction[];
  pagination: TransactionPagination;
}

export async function fetchTransactions(
  params: FetchTransactionsParams,
): Promise<FetchTransactionsResult> { /* ... */ }

export async function fetchTransactionById(
  id: string,
): Promise<Transaction> { /* ... */ }

export async function updateApprovalStatus(
  recordId: string,
  status: ApprovalStatus,
): Promise<Transaction> { /* ... */ }
```

**Security patterns in this layer:**

1. `page` is clamped to `Math.max(1, Math.floor(page))` before sending.
2. `limit` is always `PAGE_SIZE` (20). Not a parameter.
3. When `showOwn` is true, send `own=true`. When false (viewing all), omit the `own` param entirely. **Never send `own=false`.**
4. Filters are sanitized through `sanitizeFilters()` before building query params.
5. `approvalStatus` is validated against `APPROVAL_STATUSES` before sending. Invalid values are silently dropped.
6. Error responses are mapped to error codes, never exposed as raw strings. The service throws typed errors that the hook layer maps to i18n keys.

### Error handling pattern

```typescript
export class TransactionError extends Error {
  constructor(
    public code: 'FORBIDDEN' | 'NOT_FOUND' | 'NETWORK' | 'SERVER' | 'UNKNOWN',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'TransactionError';
  }
}
```

The service maps HTTP status codes to error codes:
- 403 -> `FORBIDDEN`
- 404 -> `NOT_FOUND`
- Network/timeout -> `NETWORK`
- 5xx -> `SERVER`
- Other -> `UNKNOWN`

The UI maps error codes to i18n strings. Raw `error.message` from the API is **never** displayed to the user.

---

## Sanitization Utility

### `sanitize.ts`

```typescript
import {
  TransactionFilters, EMPTY_FILTERS, FILTER_MAX_LENGTH,
  APPROVAL_STATUSES, ApprovalStatus,
} from '../types';

/** Trim and cap a string input */
export function sanitizeText(value: string): string {
  return value.trim().slice(0, FILTER_MAX_LENGTH);
}

/** Validate that a string is a valid numeric amount (or empty) */
export function isValidAmount(value: string): boolean {
  if (value === '') return true;
  return /^-?\d+(\.\d{1,2})?$/.test(value.trim());
}

/** Validate approval status against the enum */
export function isValidApprovalStatus(
  value: string | null,
): value is ApprovalStatus {
  if (value === null) return true; // null means "no filter"
  return (APPROVAL_STATUSES as readonly string[]).includes(value);
}

/** Sanitize all filters before sending to API */
export function sanitizeFilters(filters: TransactionFilters): TransactionFilters {
  return {
    statement: sanitizeText(filters.statement),
    transactionNumber: sanitizeText(filters.transactionNumber),
    client: sanitizeText(filters.client),
    project: sanitizeText(filters.project),
    amount: isValidAmount(filters.amount) ? filters.amount.trim() : '',
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    approvalStatus: isValidApprovalStatus(filters.approvalStatus)
      ? filters.approvalStatus
      : null,
  };
}

/** Check if any filter is active */
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.statement !== '' ||
    filters.transactionNumber !== '' ||
    filters.client !== '' ||
    filters.project !== '' ||
    filters.amount !== '' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.approvalStatus !== null
  );
}
```

---

## Hooks

### `useTransactionList.ts`

```typescript
interface UseTransactionListParams {
  canViewAll: boolean;  // from permissions.canViewAllTransactions
}

interface UseTransactionListReturn {
  transactions: Transaction[];
  isLoading: boolean;        // true during initial load
  isLoadingMore: boolean;    // true during pagination
  isRefreshing: boolean;     // true during pull-to-refresh
  error: TransactionError | null;
  hasMore: boolean;
  showOwn: boolean;
  filters: TransactionFilters;
  hasActiveFilters: boolean;

  setShowOwn: (own: boolean) => void;
  setFilters: (filters: TransactionFilters) => void;
  clearFilters: () => void;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;

  // Called after approval status change to update a single item in-place
  updateTransaction: (id: string, updated: Transaction) => void;
}
```

Behavior:
- Initial state: `showOwn = true`, `filters = EMPTY_FILTERS`, `page = 1`.
- Changing `showOwn` or `filters` resets to page 1 and refetches.
- `loadMore()` is a no-op if `!hasMore`, `isLoading`, or `isLoadingMore`.
- `refresh()` resets to page 1, keeps current filters and toggle.
- On unmount or logout, all data is cleared from memory. No filesystem caching.
- **Defensive own toggle**: if `!canViewAll`, `showOwn` is forced to `true` and `setShowOwn` is a no-op.

### `useApprovalAction.ts`

```typescript
interface UseApprovalActionReturn {
  isUpdating: boolean;
  execute: (
    transactionId: string,
    newStatus: ApprovalStatus,
  ) => Promise<Transaction | null>;
  // Returns updated Transaction on success, null if user cancelled or error
}
```

Behavior:
- **No optimistic updates.** Shows loading, waits for server response, then returns updated data.
- The hook does NOT show confirmation dialogs — the component handles confirmation UI before calling `execute()`.
- On error, the hook throws a `TransactionError` that the component catches and maps to an i18n message.

---

## Component Tree

```
TransactionHistoryScreen
  |-- FilterBar
  |     |-- Pressable (search icon button, 40x40, red dot when filters active)
  |     |-- SegmentedControl (Mine / All) OR static label with person icon
  |     |-- Pressable (clear X button, 32x32, visible when filters active)
  |
  |-- TransactionList (FlatList)
  |     |-- SkeletonCard x5 (loading state)
  |     |-- EmptyState (no results)
  |     |-- ErrorState (fetch error with retry)
  |     |-- TransactionCard (per item)
  |     |     |-- StatusChip (existing component)
  |     |     |-- CurrencyAmount (inline)
  |     |-- ActivityIndicator (load more footer)
  |
  |-- SearchModal (bottom sheet, opened by filter bar search button)
  |     |-- Input (statement)
  |     |-- Input (transaction number)
  |     |-- Input (client)
  |     |-- Input (project)
  |     |-- Input (amount, numeric keyboard)
  |     |-- ApprovalStatusChips (single-select)
  |     |-- DatePickerField x2 (from, to)
  |     |-- Button (Clear All, outline)
  |     |-- Button (Search, primary)
  |
  |-- TransactionDetailSheet (opened on card press)
        |-- Detail rows (two-column: label + value)
        |-- StatusChip
        |-- TransactionFlowWidget
        |-- ReceiptThumbnails
        |-- Notes strip
        |-- ApprovalActions (if canUpdateTransactions)
              |-- Confirmation Alert (native Alert.alert)
```

---

## Component Specifications

### FilterBar

- Height: 52px. Single row. Horizontal padding: 16px.
- 2px `accentGreen` line along top edge.
- Start: Search icon button (40x40), `icon` variant. Shows small red dot (8px circle, positioned top-end) when `hasActiveFilters`.
- Center: `SegmentedControl` with "Mine"/"All" segments. If `!canViewAll`, render a static `View` with person icon + "Mine" label in `foregroundSecondary`.
- End: Clear filters button (32x32 circle, `error` background, X icon in white). Visible only when `hasActiveFilters`. Appears with opacity fade (200ms).

### SegmentedControl (new reusable)

Props:
```typescript
interface SegmentedControlProps<T extends string> {
  segments: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}
```

- Background: `muted`. Active segment background: `primary`, text: `onPrimary`. Inactive text: `foregroundSecondary`.
- Sliding background with 200ms easeInOut (`LayoutAnimation` or `Animated`).
- Height: 36px. Border radius: `full`.

### TransactionCard

- Card background: `surface`, border: 1px `border`, radius: `lg` (12px).
- Margins: 8px horizontal, 4px vertical.
- Padding: 12px.
- Press feedback: opacity 0.92, 80ms. No scale animation (scale causes layout jank in FlatList).
- **Row 1**: Statement (`headingSmall`, 18px/600, max 2 lines, ellipsis) + `StatusChip` (end-aligned).
- **Row 2**: Amount (`headingMedium`, 20px/600, color: green positive / red negative / `foregroundSecondary` zero) + Currency badge (muted pill, `labelSmall`).
- **Row 3** (conditional): Tax status + dot separator + bank fees. `bodySmall`, `foregroundSecondary`. Only rendered if tax or bankFees exist.
- **Row 4**: Metadata lines — client, project, partner. Each: 12px icon + label + value, `bodyMedium`.
- **Row 5** (footer): Thin separator line (1px, `border`). Transaction number (start, `bodySmall`, `foregroundSecondary`, bold) + date "DD MMM YYYY" + receipt icon (end, `secondary` color, only if receipts exist).

### SearchModal

- 90% height bottom sheet (not 95% — leaves visible backdrop for dismiss affordance).
- Spring animation: damping 20, stiffness 200 (matches design feedback).
- Primary-colored header bar with close button (start) and centered title.
- Form fields use existing `Input` component. Amount field: `keyboardType="decimal-pad"`.
- `ApprovalStatusChips`: Row of three chips (Pending/Approved/Rejected). Single-select. Tap to select, tap again to deselect. Colors from design system approval palette.
- Two `DatePickerField` components side by side for from/to dates.
- Fixed bottom action bar with top shadow. Two buttons: Clear All (outline, flex: 1) + Search (primary, flex: 1).
- **No auto-focus on open** — prevent keyboard from immediately appearing.
- On "Search" press: sanitize all inputs, then call `setFilters()` and close.

### TransactionDetailSheet

- Draggable bottom sheet. Initial snap: 70%. Min: 50%. Max: 95%.
- Drag handle: 40x4px, `border` color, centered, 12px margin bottom.
- Title: "Transaction Details" in `headingLarge`, `primary` color.
- Two-column layout: 100px fixed label (`foregroundSecondary`, medium weight) + flex value (`foreground`, semibold).
- Fields displayed: Statement, Status (StatusChip), Total Amount (with color), Tax, Bank Fees, Transaction Number, Client, Project, Date, Recorded By.
- **TransactionFlowWidget**: [Partner] -> [Other Party]. Primary-tinted container. Directional arrow (right for expense, left for revenue). Muted when either party is undefined.
- **ReceiptThumbnails**: Horizontal `ScrollView`. 72x72px rounded squares. Display receipt thumbnails if available, placeholder icon if not. Tap does nothing in this phase (no viewer yet).
- **Notes**: If present, muted background strip (`muted` color), `bodyMedium`, padding 12px.
- **ApprovalActions**: Rendered only if `permissions.canUpdateTransactions`. Shows buttons for available status transitions (e.g., if current is Pending, show Approve and Reject). Confirmation uses `Alert.alert()` (native, not a custom dialog). Loading spinner replaces buttons during API call.

### SkeletonCard (new reusable)

Props:
```typescript
interface SkeletonCardProps {
  lines?: number; // default 4
}
```

- Animated shimmer sweep, 1.5s duration, infinite loop.
- Uses `LinearGradient` from `expo-linear-gradient` for the shimmer effect.
- Matches TransactionCard dimensions: same margins, padding, border radius.

### EmptyState (new reusable)

Props:
```typescript
interface EmptyStateProps {
  icon: string;          // Lucide icon name
  title: string;
  subtitle?: string;
}
```

- Centered vertically. Icon at 64px. Floating animation: subtle 3px translateY oscillation, 3s loop.
- Must be inside a `ScrollView` to work with pull-to-refresh.

### ErrorState (new reusable)

Props:
```typescript
interface ErrorStateProps {
  message: string;       // i18n string, never raw API error
  onRetry: () => void;
}
```

- Centered. Alert icon (48px, `error` color). Message in `bodyLarge`. Retry button below.
- No shake animation (over-engineered for a simple error state).

### DatePickerField (new reusable)

Props:
```typescript
interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  maxDate?: Date;
  minDate?: Date;
}
```

- Uses `@react-native-community/datetimepicker` (already an Expo-compatible package).
- Tappable field showing formatted date or placeholder.
- Calendar icon prefix.

---

## Design Decisions & Pushback

### Accepted from Security Review

| # | Item | Decision |
|---|------|----------|
| 1 | Error message leakage | **Accepted.** Service layer maps status codes to error codes. UI maps codes to i18n strings. Raw API messages never reach the screen. |
| 2 | No limit cap | **Accepted.** `PAGE_SIZE = 20` is a constant. |
| 3 | Page validation | **Accepted.** Page clamped to `Math.max(1, ...)` in service. |
| 4 | Receipt URL token leakage | **Deferred.** Receipt viewing is not in scope for this phase. When we build it, we will use `apiClient` to fetch as blobs. |
| 5 | Filter sanitization | **Accepted.** `sanitize.ts` handles trim, cap, numeric validation, enum validation. |
| 6 | Cache hygiene | **Accepted.** Hook state is memory-only. Cleared on unmount. No filesystem caching. |
| 8 | Defensive own/all toggle | **Accepted.** Never send `own=false`. Send `own=true` or omit entirely. |
| 9 | No optimistic updates | **Accepted.** Show loading, wait for response, then update. |
| 10 | Backend over-fetching | **Accepted.** Types only include fields we use. |

### Accepted from Design Review

| Item | Decision |
|------|----------|
| Compact filter bar (52px) | **Accepted.** Clean and space-efficient. |
| Search icon with red dot | **Accepted.** Better than a full search button. |
| SegmentedControl component | **Accepted.** Reusable. |
| Static label for non-privileged users | **Accepted.** Clear affordance. |
| Card margins 8h/4v | **Accepted.** Tighter density fits more content. |
| Currency badge pill | **Accepted.** Cleaner than inline text. |
| Footer separator + transaction number + date + receipt icon | **Accepted.** |
| Search modal 90% height (adjusted from 95%) | **90%, not 95%.** 95% leaves almost no backdrop, making it feel like a full page rather than a modal. 90% gives clear dismiss affordance. |
| Draggable detail sheet with snap points | **Accepted.** 50%/70%/95% snaps. |
| Two-column detail layout | **Accepted.** Matches Flutter. |
| Transaction flow widget | **Accepted.** Matches Flutter pattern. |
| Skeleton shimmer loading | **Accepted.** 5 cards (not 6 — 5 fills viewport on most phones). |
| Empty state with floating animation | **Accepted.** Subtle, not distracting. |

### Rejected / Modified

| Proposal | Decision | Reasoning |
|----------|----------|-----------|
| Scale 0.985 on card press | **Rejected.** Opacity-only press feedback. Scale transforms in FlatList cause layout recalculations and jank during fast scrolling. The 0.985 scale is barely visible anyway. Opacity 0.92 at 80ms is sufficient. |
| Error icon shake animation | **Rejected.** Adds complexity for minimal UX value. A static icon with retry button is clear enough. |
| Spring animation for search modal | **Modified.** Use `BottomSheet` from `@gorhom/bottom-sheet` (already needed for detail sheet). It provides spring animations out of the box. No need for custom spring config — use the library defaults. |
| Accent green line on filter bar | **Rejected.** The filter bar is a utility element, not a brand surface. Adding a decorative green line creates visual noise on a screen that's already dense with transaction cards. The accent green should appear in meaningful contexts (success states, positive amounts), not as decoration. |
| CurrencyBadge as separate component | **Rejected as a standalone `src/components/ui/` component.** A currency badge is specific to financial features, not general UI. It will be a styled `View`+`Text` inside `TransactionCard` directly. If reconciliation/payroll need it later, extract then. |
| ApprovalStatusChips as `src/components/ui/` | **Moved to feature.** `ApprovalStatusChips` is used only in the search modal within transactions. It is a feature-internal widget, not a reusable UI primitive. It lives in `src/features/transactions/components/ApprovalStatusChips.tsx`. If reconciliation reuses it later, promote it then. |

### Security item #7 (PII in server logs)

Acknowledged. This is a backend concern and out of scope for the mobile client. Noted for the backend team.

---

## Dependencies

**Already installed (no additions needed):**
- `axios` (via `apiClient`)
- `react-i18next`
- `expo-linear-gradient`
- `@react-native-community/datetimepicker` (check — may need install)

**New dependencies:**
- `@gorhom/bottom-sheet` — For the detail sheet and search modal. This is the standard bottom sheet library for React Native. It provides snap points, drag gestures, backdrop, and keyboard handling. **Do not hand-roll bottom sheet behavior.**
- `react-native-reanimated` — Required by `@gorhom/bottom-sheet`. Likely already installed (check).
- `react-native-gesture-handler` — Required by `@gorhom/bottom-sheet`. Likely already installed (check).

If `@gorhom/bottom-sheet` is not already in `package.json`, add it. The TDD engineer should verify and install before starting.

---

## i18n Keys

Add these to both `src/i18n/en.ts` and `src/i18n/ar.ts`:

```typescript
// Transaction history
loadingTransactions: 'Loading transactions...',
noTransactionsFound: 'No transactions found',
pullToRefresh: 'Pull down to refresh',
loadingMore: 'Loading more...',
mine: 'Mine',
all: 'All',

// Transaction errors (mapped from error codes)
errorForbidden: 'You do not have permission to view these transactions',
errorNotFound: 'Transaction not found',
errorNetwork: 'Unable to connect. Check your internet connection.',
errorServer: 'Server error. Please try again later.',
errorUnknown: 'An unexpected error occurred',
errorApprovalFailed: 'Failed to update approval status',
```

Most transaction-related keys already exist in the i18n files. Only add what is missing.

---

## Data Flow on Logout

When the user logs out or the session expires:

1. `AuthContext` clears authentication state.
2. The `(app)` layout unmounts, which unmounts `FinanceShell`, which unmounts `TransactionHistoryScreen`.
3. `useTransactionList` cleanup runs, clearing the `transactions` array from memory.
4. No filesystem caches to clear (we don't use any).

This satisfies security requirement #6 without explicit cleanup logic.

---

## Implementation Order (TDD)

Build in this order. Each step should have tests written first, then implementation.

### Layer 1: Pure logic (no React, no API)

1. **`types.ts`** — Interfaces, constants, `APPROVAL_STATUSES`, `PAGE_SIZE`, `EMPTY_FILTERS`.
2. **`utils/sanitize.ts`** + `__tests__/sanitize.test.ts` — All sanitization functions. Test edge cases: empty strings, strings over 200 chars, invalid amounts, SQL-injection-like strings, XSS-like strings, null approval status, invalid approval status.
3. **`utils/formatters.ts`** + `__tests__/formatters.test.ts` — Date formatting, amount formatting, amount color, partner display, employee display. Test: null values, zero amounts, negative amounts, missing employee fields, string vs object employee references.

### Layer 2: Service (API integration)

4. **`services/transactionService.ts`** + `__tests__/transactionService.test.ts` — Mock `apiClient`. Test: correct query param construction, page clamping, own toggle param behavior (true -> "true", false -> omit), filter sanitization applied, error code mapping from HTTP status, approval status validation before sending.

### Layer 3: Reusable UI components

5. **`src/components/ui/SegmentedControl.tsx`** — Pure presentational. Test with renders.
6. **`src/components/ui/SkeletonCard.tsx`** — Shimmer animation. Snapshot test.
7. **`src/components/ui/EmptyState.tsx`** — Pure presentational.
8. **`src/components/ui/ErrorState.tsx`** — Pure presentational. Test retry callback.
9. **`src/components/ui/DatePickerField.tsx`** — Wraps native picker.

### Layer 4: Feature hooks

10. **`hooks/useTransactionList.ts`** + `__tests__/useTransactionList.test.ts` — Test with `renderHook`. Mock `transactionService`. Test: initial fetch, pagination (loadMore increments page), filter change resets page, own toggle resets page, defensive own toggle (canViewAll=false forces own=true), refresh behavior, error states, updateTransaction replaces item in list.
11. **`hooks/useApprovalAction.ts`** + `__tests__/useApprovalAction.test.ts` — Test: calls service with correct params, returns updated transaction on success, throws TransactionError on failure, isUpdating flag lifecycle.

### Layer 5: Feature components

12. **`components/ApprovalStatusChips.tsx`** — Feature-internal chip selector.
13. **`components/TransactionFlowWidget.tsx`** — Partner/other party visual.
14. **`components/ReceiptThumbnails.tsx`** — Horizontal thumbnail strip.
15. **`components/TransactionCard.tsx`** — Single card. Uses `StatusChip`, formatters.
16. **`components/FilterBar.tsx`** — Search icon + segmented control + clear button.
17. **`components/SearchModal.tsx`** — Bottom sheet with form.
18. **`components/ApprovalActions.tsx`** — Status transition buttons.
19. **`components/TransactionDetailSheet.tsx`** — Bottom sheet with details.
20. **`components/TransactionList.tsx`** — FlatList with loading/empty/error states.
21. **`components/TransactionHistoryScreen.tsx`** — Orchestrator. Wires hook to components.

### Layer 6: Integration

22. **Wire into `FinanceShell.tsx`** — Replace `PlaceholderTab` for operations with `TransactionHistoryScreen`, passing `permissions` from context.

---

## Integration Point

In `src/navigation/FinanceShell.tsx`, replace the operations `PlaceholderTab` with:

```tsx
import { TransactionHistoryScreen } from '../features/transactions/components/TransactionHistoryScreen';

// Inside the tab content loop, when tab === 'operations':
<TransactionHistoryScreen permissions={permissions} />
```

`TransactionHistoryScreen` receives `UserPermissions` as a prop and reads `canViewAllTransactions` and `canUpdateTransactions` from it.

---

## What NOT to Build

- No transaction creation form (Phase 3 continued)
- No receipt editor/upload (Phase 3 continued)
- No receipt full-screen viewer or download
- No share intent handling
- No employee autocomplete / search-as-you-type fields
- No employee cache service
- No form cache service
- No sound feedback
- No offline support or persistence layer
- No custom bottom sheet implementation — use `@gorhom/bottom-sheet`
- No analytics or tracking events
- No deep linking to specific transactions
