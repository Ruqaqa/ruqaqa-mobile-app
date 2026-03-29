# Receipt Editor Security Review

**Auditor:** Security Agent
**Date:** 2026-03-29
**Scope:** Architecture doc (`docs/receipt-editor-architecture.md`), designer UI code (`ReceiptEditorScreen.tsx`, `EditableReceiptGrid.tsx`, `ReceiptUploadProgress.tsx`), existing code (`ReceiptPickerSection.tsx`, `ReceiptThumbnails.tsx`, `sanitize.ts`, `apiClient.ts`, `permissionService.ts`), and Flutter source of truth.

---

## Summary

The architecture is sound. The two-mode split (add-only vs full-edit), separate API endpoints per mode, and priority rule (full-edit wins) mirror the proven Flutter implementation. Below are findings organized by severity, with concrete exploit scenarios and recommended fixes for the implementation phase.

---

## CRITICAL

### C1. Add-only mode must not send existing receipt IDs — enforce at build time

**Threat:** A malicious add-only user intercepts the save flow and injects arbitrary `receiptIds` into a full-edit `PUT /transactions` call, effectively removing receipts they shouldn't be allowed to touch.

**Architecture mitigation (good):** The architecture specifies separate endpoints — `POST /transactions/add-receipts` for add-only, `PUT /transactions` for full-edit. This is correct.

**Risk in implementation:** The `ReceiptEditorScreen.tsx` currently delegates save logic to callback props (`onUploadFiles`, `onRemoveReceipts`). The `onRemoveReceipts` prop is optional, meaning add-only mode callers should not provide it. However, nothing in the screen itself prevents `handleSave` from calling `onRemoveReceipts` if it's passed incorrectly by the parent.

**Exploit scenario:** A developer wiring up the parent accidentally passes `onRemoveReceipts` for add-only mode, or a malicious actor patches the JS bundle on a rooted device to swap the mode.

**Recommendation:**
```typescript
// In receiptService.ts — the service layer MUST enforce mode
export async function addReceiptsToTransaction(
  transactionId: string,
  newReceiptIds: string[],
): Promise<void> {
  // CRITICAL: This endpoint ONLY adds. Never accepts existing IDs to keep/remove.
  if (newReceiptIds.length === 0) return;
  // Validate all IDs are ObjectId format before sending
  for (const id of newReceiptIds) {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new ReceiptUploadError('UNKNOWN', 'Invalid receipt ID format');
    }
  }
  await apiClient.post('/transactions/add-receipts', {
    transactionId,
    newReceiptIds,
  });
}
```

Additionally, in `useReceiptEditor.ts`, the `toggleExistingReceipt` function MUST be a no-op when mode is `'add-only'`:
```typescript
const toggleExistingReceipt = useCallback((receiptId: string) => {
  if (mode !== 'full-edit') return; // Hard guard, not just UI
  // ...toggle logic
}, [mode]);
```

**Status:** Architecture addresses this correctly. Implementation must follow through.

---

### C2. Partner check must compare server-provided IDs, not client-supplied values

**Threat:** The `canAddReceiptsAsPartner()` check verifies `partnerEmployee.id === currentEmployeeId`. If `currentEmployeeId` is sourced from client-editable state (e.g., manipulated JWT claims stored locally), a user could spoof being the partner.

**Current state (good):** The Expo app's `employee.id` comes from the post-login validation pipeline (`postLoginValidation` -> `employeeService.ts` -> server lookup). The `currentEmployeeId` is the server-verified employee ID, not a raw JWT field.

**Remaining risk:** The `transaction.partnerEmployee` data comes from `fetchTransactionById()`. If the user can tamper with the cached/in-memory transaction object, they could fake the partner match. This is mitigated because the backend enforces permission checks on `POST /transactions/add-receipts` — the client check is UX-only.

**Recommendation:** Add a comment in `receiptEditorPermissions.ts` making it explicit that this is a UX gate:
```typescript
/**
 * UX-only check. The backend re-verifies partner identity on
 * POST /transactions/add-receipts. This prevents showing the button
 * to users who would get a 403 anyway.
 */
export function canAddReceiptsAsPartner(...) { ... }
```

**Backend verification required:** Confirm the backend `POST /transactions/add-receipts` endpoint checks:
1. The requesting user has `transactions_add_receipts` role
2. The transaction's `partnerType === 'employee'`
3. The transaction's `partnerEmployee` matches the authenticated user's employee ID

If the backend does NOT enforce check #3, this becomes a true critical vulnerability — any user with `transactions_add_receipts` could add receipts to any transaction where `partnerType === 'employee'`.

**Status:** Client-side looks correct. Backend enforcement is the actual security boundary.

---

### C3. Receipt ID injection — validate IDs client-side before sending

**Threat:** In full-edit mode, the client sends `{ transactionId, receiptIds: [...] }` via `PUT /transactions`. A malicious user on a rooted device could inject arbitrary receipt IDs belonging to other transactions/users.

**Backend must validate** that all `receiptIds` in the request either:
- Already belong to the given transaction, OR
- Were uploaded by the same authenticated user in the current session

**Client-side mitigation:** Validate all IDs are valid ObjectId format before sending (already covered by `isValidObjectId` in `sanitize.ts`). The `useReceiptEditor` hook should only allow IDs that came from either:
- `existingReceipts.map(r => r.id)` (loaded from server)
- `uploadReceipt()` return values (just uploaded)

**Recommendation for `useReceiptEditor.ts`:**
```typescript
// On save, build the final list from trusted sources only
const allReceiptIds = [
  ...Array.from(keptReceiptIds),  // subset of existingReceipts[].id
  ...newlyUploadedIds,            // from uploadReceipt() responses
];

// Validate every ID
for (const id of allReceiptIds) {
  if (!isValidObjectId(id)) {
    throw new Error('Invalid receipt ID detected');
  }
}
```

**Status:** Architecture is sound. Implementation must wire up ID validation.

---

## HIGH

### H1. Unbounded new attachments — enforce max count

**Threat:** No limit on how many new receipts can be added to a transaction. An attacker could repeatedly add 4 receipts, save, then add 4 more, creating unlimited server storage consumption.

**Current state (partial):** `ReceiptEditorScreen.tsx` line 104 calculates `remainingSlots` based on `MAX_ATTACHMENTS - existingReceipts.length + markedForDeletion.size`. This limits per-session additions but doesn't cap the total receipt count across sessions.

**Recommendation:** The backend should enforce a maximum total receipt count per transaction (e.g., 20). The client should also check:
```typescript
const MAX_TOTAL_RECEIPTS_PER_TRANSACTION = 20;
const totalAfterSave = existingReceipts.length - markedForDeletion.size + newAttachments.length;
if (totalAfterSave > MAX_TOTAL_RECEIPTS_PER_TRANSACTION) {
  // Prevent save, show error
}
```

**Status:** Needs implementation-time enforcement on both client and server.

---

### H2. Race condition — concurrent receipt edits can lose data

**Threat:** Two users open the same transaction's receipt editor simultaneously. User A removes receipt #3 and saves. User B (who loaded the old state) adds a receipt and saves. In full-edit mode, User B's save sends `receiptIds` including receipt #3 (which they loaded) plus the new one — effectively undoing User A's removal.

**Architecture note:** The architecture acknowledges this in the error handling table ("Stale receipt IDs" under Medium) but it's arguably High severity for full-edit mode since it can silently undo another user's intentional removal.

**Mitigation options:**
1. **Optimistic concurrency control:** Include a `version` or `updatedAt` field. Backend rejects if stale. This is the proper fix but requires backend changes.
2. **Client refresh on save:** Before building the final `receiptIds` list, re-fetch the transaction to get the latest receipt state. Warn the user if it changed. This is implementable client-side only.
3. **Accept the risk:** For a small team, concurrent edits are rare. Document the behavior.

**Recommendation:** Option 2 — add a freshness check in the save flow:
```typescript
// Before save, re-fetch to detect concurrent changes
const fresh = await fetchTransactionById(transactionId);
const freshIds = new Set(fresh.expenseReceipts?.map(r => r.id) ?? []);
const loadedIds = new Set(existingReceipts.map(r => r.id));
if (!setsEqual(freshIds, loadedIds)) {
  // Receipts changed since we loaded — warn user, offer to reload
  throw new ReceiptUploadError('STALE', t('receiptStaleWarning'));
}
```

**Status:** Not addressed in current code. Recommend implementing Option 2 or 3.

---

### H3. Upload without linking — orphaned files on server

**Threat:** Files uploaded via `POST /receipts/upload` but the subsequent `POST /transactions/add-receipts` or `PUT /transactions` fails. The uploaded files remain on the server with no transaction reference.

**Architecture acknowledgment:** "Uploaded receipts are orphaned on server (acceptable — backend can GC)."

**Recommendation:** This is acceptable IF the backend has garbage collection for orphaned receipts. Verify:
- Backend tracks upload timestamp on receipts
- A scheduled job or on-demand cleanup removes receipts not linked to any transaction after N hours
- Rate limit on `POST /receipts/upload` to prevent storage abuse (e.g., max 20 uploads per user per hour)

**Status:** Acknowledged risk. Backend GC needed.

---

### H4. File upload MIME type should be validated server-side, not trusted from client

**Threat:** The client sends `{ type: att.mimeType }` in the FormData. A rooted device can set `mimeType: 'image/jpeg'` on an executable file.

**Current client validation (good):** `validateReceiptFile()` checks against `ALLOWED_MIME_TYPES` whitelist and `MAX_FILE_SIZE_BYTES`. `sanitizeFilename()` strips path separators and null bytes.

**Required server-side defense:**
- Backend MUST inspect file magic bytes (not just Content-Type header)
- Backend MUST re-validate file size
- Backend MUST sanitize the stored filename
- Backend MUST store files with a generated name, not the client-provided name

**Status:** Client validation is correctly implemented. Server validation is the security boundary.

---

## MEDIUM

### M1. Error messages must not leak server internals

**Current state (good):** The architecture specifies an `ERROR_CODE_MAP` that maps backend error codes to i18n keys. The existing `transactionService.ts` pattern (`mapError()`) never exposes raw server error messages.

**Risk in designer code:** `ReceiptEditorScreen.tsx` line 290:
```typescript
Alert.alert(t('error'), err?.message || t('errorUnknown'));
```

If `err` is an `AxiosError` with a server response body containing internal details, `err.message` would leak it.

**Fix:** Use the same error mapping pattern as `transactionService.ts`:
```typescript
// In receiptService.ts — wrap all API calls
function mapReceiptError(error: unknown): ReceiptUploadError {
  if (error instanceof ReceiptUploadError) return error;
  if (error instanceof AxiosError) {
    if (!error.response) return new ReceiptUploadError('NETWORK');
    const status = error.response.status;
    const code = error.response.data?.error?.code;
    if (code && ERROR_CODE_MAP[code]) {
      return new ReceiptUploadError(code, ERROR_CODE_MAP[code]);
    }
    if (status === 403) return new ReceiptUploadError('FORBIDDEN');
    if (status >= 500) return new ReceiptUploadError('SERVER');
  }
  return new ReceiptUploadError('UNKNOWN');
}
```

Then in the screen, only display i18n-mapped messages:
```typescript
} catch (err) {
  const mapped = err instanceof ReceiptUploadError ? err : new ReceiptUploadError('UNKNOWN');
  Alert.alert(t('error'), t(mapped.code === 'UNKNOWN' ? 'errorUnknown' : ERROR_CODE_MAP[mapped.code] ?? 'errorUnknown'));
}
```

**Status:** Architecture addresses this. Implementation must follow the pattern.

---

### M2. Upload progress UI does not expose sensitive paths (good)

The `ReceiptUploadProgress.tsx` only displays `file.name` (which is the sanitized filename) and status. It does not expose file URIs, server paths, or upload endpoints. No issue here.

**Status:** Clean.

---

### M3. Token leakage via query parameter in PDF viewer

**Existing issue in `ReceiptThumbnails.tsx`** (not new to receipt editor, but relevant):

Line 55: `buildExternalUrl()` appends `?token=...` to the URL for external PDF viewers. This token could be logged in server access logs, cached in browser history, or leaked via Referer headers.

**Recommendation:** This is a known tradeoff for opening PDFs in external viewers (which can't send Authorization headers). Mitigate by:
- Using short-lived tokens for this endpoint (backend)
- The receipt editor's `EditableReceiptGrid` does NOT use this pattern (it uses `authHeaders` for `Image` component) — this is correct

**Status:** Pre-existing. Not introduced by the receipt editor.

---

### M4. `Date.now()` in attachment IDs is not cryptographically unique

`ReceiptEditorScreen.tsx` line 137:
```typescript
id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
```

`Math.random()` is not cryptographically secure. However, these IDs are local-only (used as React keys and for matching upload progress). They're never sent to the server — the server assigns its own receipt IDs. No security impact.

**Status:** Acceptable. Not a vulnerability.

---

## LOW

### L1. Large file DoS — client and server both enforce 10MB limit

**Current state (good):** `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB) is checked in `validateReceiptFile()` before adding attachments. Combined with `MAX_ATTACHMENTS = 4`, the theoretical max upload per save is 40 MB.

**Recommendation:** Server should independently enforce the 10 MB limit and reject oversized files early (before buffering the entire body). This appears to be the case based on the Flutter `ReceiptUploadService` which uploads individual files — the server processes them one at a time.

**Status:** Adequately mitigated.

---

### L2. `handleToggleDelete` accessible on disabled Pressable

In `EditableReceiptGrid.tsx`, the `Pressable` is `disabled={!editable}` which prevents touch events. However, accessibility services or automated testing frameworks might still be able to invoke `onPress`. The `handlePress` function has a redundant guard:
```typescript
const handlePress = useCallback(() => {
  if (editable) {
    onToggleDelete(receipt.id);
  }
}, [editable, onToggleDelete, receipt.id]);
```

**Status:** Already mitigated with the guard inside `handlePress`. Good defense in depth.

---

## Positive Findings (Things Done Well)

1. **Separate endpoints for add-only vs full-edit** — Correct architectural decision. Prevents the add-only mode from ever constructing a full replacement payload.

2. **Filename sanitization** — `sanitizeFilename()` strips `/`, `\`, and null bytes. Applied in both `ReceiptPickerSection` and the form hook.

3. **MIME type whitelist** — `ALLOWED_MIME_TYPES` / `ALLOWED_RECEIPT_MIME_TYPES` with explicit allowlist, not a blocklist. Only images and PDF.

4. **Error code mapping** — Architecture specifies `ERROR_CODE_MAP` to prevent raw server error leakage, following the established `transactionService.ts` pattern.

5. **Client-side validation as UX, not security** — The CLAUDE.md correctly states "Client-side permission checks are UX-only — the backend is the security boundary."

6. **Sanitization utilities** — `sanitize.ts` provides `isValidObjectId()`, `isAllowedMimeType()`, `isWithinSizeLimit()`, and `sanitizeFilename()` — all reusable for the receipt editor implementation.

7. **No raw server errors in existing code** — `transactionService.ts` uses `mapError()` and `useTransactionForm.ts` maps HTTP status codes to i18n keys. The receipt editor should follow the same pattern.

8. **Deduplicated token refresh** — `apiClient.ts` prevents concurrent refresh calls. Upload retries won't cause auth storms.

---

## Implementation Checklist for TDD Agent

Security requirements that MUST be covered by tests:

- [ ] `getReceiptEditMode()` returns `null` when user has neither permission
- [ ] `getReceiptEditMode()` returns `'full-edit'` when user has `canUpdateTransactions` (even if also has `canAddReceiptsToSubmitted`)
- [ ] `getReceiptEditMode()` returns `'add-only'` only when partner match + permission
- [ ] `canAddReceiptsAsPartner()` rejects when `partnerType !== 'employee'`
- [ ] `canAddReceiptsAsPartner()` rejects when `partnerEmployee.id !== currentEmployeeId`
- [ ] `canAddReceiptsAsPartner()` handles both string and object `partnerEmployee`
- [ ] `canAddReceiptsAsPartner()` rejects when `currentEmployeeId` is null
- [ ] `toggleExistingReceipt()` is a no-op in add-only mode
- [ ] `addReceiptsToTransaction()` validates all receipt IDs are ObjectId format
- [ ] `addReceiptsToTransaction()` never sends existing receipt IDs (only new ones)
- [ ] `updateTransactionReceipts()` validates all receipt IDs are ObjectId format
- [ ] Save flow in add-only mode calls `POST /transactions/add-receipts` (not PUT)
- [ ] Save flow in full-edit mode calls `PUT /transactions` with correct payload shape
- [ ] Error from API is mapped to i18n key, not raw message
- [ ] Upload failure stops remaining uploads and allows retry
- [ ] Retry skips already-uploaded files (state === 'done')
- [ ] File validation rejects non-whitelisted MIME types
- [ ] File validation rejects files over 10 MB
- [ ] Filename sanitization strips path separators and null bytes
