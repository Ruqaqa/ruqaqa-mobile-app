# Receipt Editor Architecture

## Overview

Feature for managing receipts on **existing, submitted transactions**. Two permission-based modes share one screen component:

| | Add-Only Mode | Full Edit Mode |
|--|--|--|
| **Permission** | `canAddReceiptsToSubmitted` (role: `transactions_add_receipts`) | `canUpdateTransactions` (role: `transactions_update`) |
| **Extra gate** | Must be partner employee on the transaction | Just the permission |
| **Can add** | Yes | Yes |
| **Can remove** | No | Yes |
| **API endpoint** | `POST /transactions/add-receipts` | `PUT /transactions` |
| **Payload** | `{ transactionId, newReceiptIds }` | `{ transactionId, receiptIds }` (all kept + new) |

Priority rule: if user has **both** permissions, full-edit takes precedence (matches Flutter behavior).

---

## File Structure

```
src/features/transactions/
  services/
    receiptService.ts              # NEW — upload + add-receipts + full-update API calls
    transactionService.ts          # EXISTING — no changes needed
  hooks/
    useReceiptEditor.ts            # NEW — state machine for the editor screen
  utils/
    receiptEditorPermissions.ts    # NEW — canAddReceiptsAsPartner + getReceiptEditMode
  components/
    ReceiptEditorScreen.tsx         # NEW — full-screen modal (like TransactionFormScreen)
    ExistingReceiptGrid.tsx         # NEW — editable grid with delete toggle (full-edit mode)
    TransactionDetailSheet.tsx      # MODIFIED — add receipt edit/add button
    ReceiptPickerSection.tsx        # EXISTING — reused as-is for adding new files
    ReceiptThumbnails.tsx           # EXISTING — reused for read-only display (add-only mode)
```

**Total new files: 4.** Minimal surface area.

---

## Key Interfaces

### receiptService.ts

```typescript
import { ReceiptAttachment } from '../components/ReceiptPickerSection';

export class ReceiptUploadError extends Error {
  constructor(
    public code: 'NETWORK' | 'FORBIDDEN' | 'INVALID_FILE' | 'FILE_TOO_LARGE' | 'SERVER' | 'UNKNOWN',
    message?: string,
  ) { ... }
}

/** Upload a single receipt file. Returns the server-assigned receiptId. */
export async function uploadReceipt(
  attachment: ReceiptAttachment,
  onProgress?: (percent: number) => void,
): Promise<string>;

/** Add-only mode: POST /transactions/add-receipts */
export async function addReceiptsToTransaction(
  transactionId: string,
  newReceiptIds: string[],
): Promise<void>;

/** Full-edit mode: PUT /transactions with full receipt ID list */
export async function updateTransactionReceipts(
  transactionId: string,
  allReceiptIds: string[],
): Promise<void>;
```

**Design decision:** Separate file from `transactionService.ts`. Rationale:
- `transactionService.ts` is list/detail/approval — different concern
- Receipt upload uses `uploadMultipart()` (different transport)
- Keeps each service focused and testable independently
- Flutter also has a separate `ReceiptUploadService`

### receiptEditorPermissions.ts

```typescript
import { UserPermissions } from '@/types/permissions';
import { Transaction } from '../types';

export type ReceiptEditMode = 'add-only' | 'full-edit' | null;

/** Determine which edit mode (if any) applies for this transaction + user. */
export function getReceiptEditMode(
  transaction: Transaction,
  permissions: UserPermissions,
  currentEmployeeId: string | null,
): ReceiptEditMode;

/** Check if user can add receipts as the partner party. */
export function canAddReceiptsAsPartner(
  transaction: Transaction,
  permissions: UserPermissions,
  currentEmployeeId: string | null,
): boolean;
```

Logic (mirrors Flutter `_canAddReceiptsAsPartner()`):
1. `canUpdateTransactions` → return `'full-edit'` (takes priority)
2. `canAddReceiptsToSubmitted` AND `partnerType === 'employee'` AND `partnerEmployee.id === currentEmployeeId` → return `'add-only'`
3. Otherwise → return `null`

### useReceiptEditor.ts

```typescript
export interface ReceiptEditorState {
  mode: 'add-only' | 'full-edit';
  existingReceipts: TransactionReceipt[];   // from transaction
  keptReceiptIds: Set<string>;              // full-edit: toggleable; add-only: all kept
  newAttachments: ReceiptAttachment[];      // locally picked, not yet uploaded
  uploadProgress: Map<string, UploadStatus>; // key = attachment.id
  isSaving: boolean;
  error: string | null;
}

export interface UploadStatus {
  state: 'pending' | 'uploading' | 'done' | 'failed';
  percent: number;         // 0-100
  receiptId?: string;      // set when state === 'done'
  errorKey?: string;       // i18n key when state === 'failed'
}

export function useReceiptEditor(options: {
  transactionId: string;
  existingReceipts: TransactionReceipt[];
  mode: 'add-only' | 'full-edit';
  onSuccess: () => void;
}): {
  state: ReceiptEditorState;
  addAttachment: (att: ReceiptAttachment) => void;
  removeAttachment: (id: string) => void;
  toggleExistingReceipt: (receiptId: string) => void;  // full-edit only, no-op in add-only
  save: () => Promise<void>;
  canSave: boolean;
};
```

### ReceiptEditorScreen props

```typescript
interface ReceiptEditorScreenProps {
  visible: boolean;
  transactionId: string;
  existingReceipts: TransactionReceipt[];
  mode: 'add-only' | 'full-edit';
  onClose: () => void;
  onSuccess: () => void;
}
```

Presented as a **full-screen Modal** (matches `TransactionFormScreen` pattern). Not a bottom sheet — the screen needs scroll space for receipt grids + picker.

---

## Data Flow

### Save flow (add-only mode)

```
User taps Save
  │
  ├─ For each newAttachment (sequentially):
  │     uploadReceipt(attachment) → receiptId
  │     Update uploadProgress map
  │     If any upload fails → stop, show error, allow retry
  │
  ├─ Collect all successful receiptIds
  │
  ├─ POST /transactions/add-receipts
  │     { transactionId, newReceiptIds: [...] }
  │
  └─ Success → onSuccess() callback → parent refreshes transaction
```

### Save flow (full-edit mode)

```
User taps Save
  │
  ├─ Upload new attachments (same as above)
  │
  ├─ Build final receipt list:
  │     keptReceiptIds (from existing, minus any toggled off)
  │     + newly uploaded receiptIds
  │
  ├─ PUT /transactions
  │     { transactionId, receiptIds: [...all] }
  │
  └─ Success → onSuccess()
```

### Opening the editor from TransactionDetailSheet

```
TransactionDetailSheet
  │
  ├─ getReceiptEditMode(transaction, permissions, employee.id)
  │     → 'full-edit' | 'add-only' | null
  │
  ├─ If 'full-edit': Show "Edit" button next to receipts header
  ├─ If 'add-only': Show "Add Receipts" button
  ├─ If null: No button (view-only)
  │
  └─ On button press:
       Close detail sheet → Open ReceiptEditorScreen
       On success → refetch transaction → reopen detail sheet with updated data
```

---

## Upload Progress Tracking

**Per-file status model.** Each new attachment gets its own `UploadStatus` entry:

- `pending` → file picked, not yet uploading
- `uploading` → `uploadMultipart` in progress, `percent` updating via `onUploadProgress`
- `done` → `receiptId` captured
- `failed` → `errorKey` set (i18n key)

**Sequential uploads** (not parallel). Reasons:
- Matches Flutter behavior (sequential within batches)
- Simpler error recovery — stop at first failure, user can retry
- Avoids thundering herd on poor mobile connections
- `uploadMultipart()` already handles auth/retry per request

The save button shows aggregate progress: "Uploading 2/4..." with individual progress bars on each thumbnail.

**Retry on failure:** The `save()` function skips already-uploaded attachments (those with `state === 'done'`). User taps Save again → only retries failed/pending ones.

---

## ExistingReceiptGrid (full-edit mode)

Renders existing `TransactionReceipt[]` as a grid. Each item has:
- Thumbnail (image) or PDF icon — reuses rendering logic from `ReceiptThumbnails`
- A toggle overlay: tap to mark for removal (dims + shows X overlay)
- Removed items tracked via `keptReceiptIds` Set in the hook

In **add-only mode**, existing receipts render via the existing `ReceiptThumbnails` component (read-only horizontal scroll) — no new component needed.

### Mapping receipts to IDs

`TransactionReceipt` already has an `id` field. The `keptReceiptIds` Set is initialized from `existingReceipts.map(r => r.id)`. Toggle removes/re-adds the ID. On save, only IDs still in the Set are sent.

---

## Changes to TransactionDetailSheet

Minimal changes — add a button row in the receipts section:

1. Import `getReceiptEditMode` from `receiptEditorPermissions.ts`
2. Accept two new props: `employeeId: string | null` and `permissions: UserPermissions`
3. Compute `editMode = getReceiptEditMode(transaction, permissions, employeeId)`
4. Render button based on mode:
   - `'full-edit'` → Edit icon button with `t('edit')` label
   - `'add-only'` → Plus icon button with `t('addReceipts')` label
5. New prop: `onEditReceipts: (mode: ReceiptEditMode) => void` — parent handles navigation

**The button is shown even when `expenseReceipts` is empty** (user may want to add receipts to a transaction that has none). This matches Flutter behavior at line 140 of `transaction_details_modal.dart`.

The parent (`TransactionHistoryScreen`) manages the `ReceiptEditorScreen` visibility, passing the mode and wiring up the success callback to refresh the transaction list.

---

## Error Handling

| Error scenario | Handling |
|---|---|
| Upload fails (network) | Mark attachment as `failed`, stop remaining uploads, show i18n error. Save button becomes "Retry" — skips completed uploads. |
| Upload fails (file rejected: type/size) | Show specific error from `ReceiptUploadError.code` mapped to i18n key. Should be rare since client validates before picking. |
| Add-receipts/update API fails | Show generic error toast. Uploaded receipts are orphaned on server (acceptable — backend can GC). |
| 403 on add-receipts (not partner) | Show `t('notPartnerParty')` error. Can happen if transaction was reassigned between open and save. |
| No new receipts to add (add-only) | Disable save button. If somehow reached, show info toast and close. |

Error codes from backend mapped to i18n keys:

```typescript
const ERROR_CODE_MAP: Record<string, string> = {
  PERMISSION_DENIED: 'receiptPermissionDenied',
  NOT_PARTNER_PARTY: 'notPartnerParty',
  TRANSACTION_NOT_FOUND: 'transactionNotFound',
  INVALID_RECEIPT_IDS: 'invalidReceiptIds',
  NO_FILE: 'receiptNoFile',
  INVALID_FILE_TYPE: 'invalidFileType',
  FILE_TOO_LARGE: 'fileTooLarge',
  UPLOAD_FAILED: 'receiptUploadFailed',
};
```

---

## Permission Check: currentEmployeeId

The Expo app's `AuthContext` exposes `employee: Employee | null` where `Employee.id` is the Keycloak-synced employee document ID. This is the same ID stored in `transaction.partnerEmployee.id`.

No new permission field or plumbing needed — `employee.id` is already available via `useAuth()` in the component tree. Pass it down to `getReceiptEditMode()`.

---

## i18n Keys Needed

```
addReceipts          — already exists
editReceipts         — "Edit Receipts" / "تعديل الإيصالات"
existingReceipts     — "Current Receipts" / "الإيصالات الحالية"
newReceipts          — "New Receipts" / "إيصالات جديدة"
saveChanges          — "Save Changes" / "حفظ التغييرات"
uploadingReceipts    — "Uploading {{current}}/{{total}}..." / "جاري الرفع {{current}}/{{total}}..."
receiptUploadFailed  — "Failed to upload receipt" / "فشل في رفع الإيصال"
receiptSaveSuccess   — "Receipts saved successfully" / "تم حفظ الإيصالات بنجاح"
receiptAddSuccess    — "{{count}} receipt(s) added" / "تمت إضافة {{count}} إيصال"
notPartnerParty      — "You can only add receipts to your own transactions" / "يمكنك فقط إضافة إيصالات لمعاملاتك"
noNewReceipts        — "No new receipts to add" / "لم يتم إضافة إيصالات جديدة"
markedForRemoval     — "Marked for removal" / "محدد للإزالة"
```

---

## Testing Strategy

### Unit tests (Jest)

1. **`receiptEditorPermissions.test.ts`** — Core business logic:
   - `getReceiptEditMode`: full-edit when `canUpdateTransactions`, add-only when partner match, null when no permission, full-edit takes priority over add-only
   - `canAddReceiptsAsPartner`: employee match, string vs object `partnerEmployee`, wrong partnerType, missing employee ID

2. **`receiptService.test.ts`** — API integration (mock axios):
   - `uploadReceipt`: success returns receiptId, 400 maps to correct error code, network error
   - `addReceiptsToTransaction`: success, 403 → FORBIDDEN, 404 → NOT_FOUND
   - `updateTransactionReceipts`: success, error mapping

3. **`useReceiptEditor.test.ts`** — Hook behavior (renderHook):
   - Add/remove attachments
   - Toggle existing receipt in full-edit mode
   - Toggle no-op in add-only mode
   - Save flow: uploads sequentially, calls correct API based on mode
   - Retry after failure skips completed uploads
   - `canSave` false when no changes

### E2E tests (Maestro)

Deferred — depends on test account permissions and receipt data. Can be written after implementation.
