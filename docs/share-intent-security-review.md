# Share Intent Security Review

> Date: 2026-03-29
> Reviewer: Security Agent
> Status: Complete (architecture doc + UI code + existing patterns reviewed)

---

## Scope

This review covers the share intent feature, which receives files from external apps via Android intent / iOS share extension and routes them into the app. This is a **critical trust boundary** — all data originates outside the app and must be treated as untrusted.

### Reviewed artifacts
- `docs/share-intent-architecture.md` — Architecture design (Task #1)
- `src/components/share/FlowSelectorSheet.tsx` — Flow selector UI (Task #2)
- `src/components/share/SharedFilesPreview.tsx` — File thumbnail preview (Task #2)
- `src/components/share/SharePendingBanner.tsx` — Pre-auth pending files banner (Task #2)
- `src/features/transactions/utils/sanitize.ts` — Existing sanitization patterns
- `src/features/transactions/components/ReceiptPickerSection.tsx` — Existing receipt validation
- `src/features/transactions/hooks/useTransactionForm.ts` — Attachment add flow
- `src/utils/mediaUrl.ts` — Trusted domain URL validation
- `../finance_mobile/lib/features/transactions/services/share_receipt_flow_service.dart` — Flutter source (reference implementation)

---

## Executive Summary

The share intent feature introduces a new external input boundary. Files shared from other apps carry untrusted URIs, MIME types, file names, and sizes. The current Flutter implementation performs **zero security validation** on shared files. The Expo implementation must not repeat this.

The designer's UI components (`SharedFilesPreview`, `FlowSelectorSheet`) correctly separate presentation from data handling, but they accept a `SharedFile` type with raw `uri`, `mimeType`, and `fileName` fields that must be validated before reaching these components.

**Critical finding:** The architecture doc (`docs/share-intent-architecture.md`) designs the service layer with partial validation but has several security gaps that must be addressed before implementation.

### Architecture doc security gaps (summary)

1. **No sandbox copy**: Architecture states "No file content is persisted to disk" and passes `content://` URIs directly — TOCTOU vulnerability (CRITICAL-3)
2. **Size check bypassed when null**: `handleIncomingFiles()` only checks size if `fileSize != null` — file bombs pass through (CRITICAL-1)
3. **No filename sanitization on receipt**: Architecture mentions `sanitizeFilename()` but never calls it in `handleIncomingFiles()` (CRITICAL-2)
4. **No URI scheme validation**: Any non-empty URI string is accepted (CRITICAL-1)
5. **Good: Permission gating via `isAvailable()`**: Flow targets correctly check permissions
6. **Good: In-memory store**: No stale file persistence risk (but see CRITICAL-3 for TOCTOU)

---

## Findings

### CRITICAL-1: Incomplete file validation in architecture's handleIncomingFiles()

**Severity:** Critical
**Component:** `shareIntentService.ts` — `handleIncomingFiles()` (architecture doc lines 223-259)

**Exploit scenario:** The architecture's `handleIncomingFiles()` has two gaps:

**Gap A — File size bypass:** The code checks `if (fileSize != null && fileSize > GLOBAL_MAX_FILE_SIZE)` — but `fileSize` comes from the sharing library (`raw.fileSize ?? raw.size ?? null`). If the source app doesn't report file size (which is common for `content://` URIs), `fileSize` is `null` and the check is skipped entirely. A malicious app shares a 5GB file without declaring its size — the file passes validation and enters the store.

**Gap B — No URI scheme check:** The code checks `if (!uri) continue` but accepts ANY non-empty URI string. A crafted intent could pass `javascript:alert(1)` or `data:text/html,...` as the URI. While these won't directly execute in React Native, they could cause unexpected behavior in `<Image source={{ uri }}>` or `FileSystem` calls.

Combined impact:
1. A 5GB file with no declared size enters the pending queue
2. `SharedFilesPreview` tries to render it as an image thumbnail (OOM crash)
3. If the user completes the form, the file is uploaded to the server

**Required validation (all must happen in the service layer, before queuing):**

```typescript
// --- shareIntentService.ts validation functions ---

import * as FileSystem from 'expo-file-system';

const ALLOWED_SHARE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
] as const;

const MAX_SHARE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — match existing receipt limit
const MAX_SHARED_FILES = 4; // Match MAX_ATTACHMENTS from ReceiptPickerSection

/**
 * Validate a file received via share intent.
 * Returns null if valid, or an error code string if invalid.
 *
 * MUST be called before any file is queued, displayed, or stored.
 */
export async function validateSharedFile(
  uri: string,
  declaredMimeType: string | null | undefined,
): Promise<{ error: string | null; fileInfo?: FileSystem.FileInfo & { exists: true } }> {
  // 1. URI scheme validation — only content:// and file:// are valid share sources
  if (!uri.startsWith('content://') && !uri.startsWith('file://')) {
    return { error: 'invalidUri' };
  }

  // 2. MIME type whitelist (declared type — we check this first as a fast reject)
  if (
    !declaredMimeType ||
    !(ALLOWED_SHARE_MIME_TYPES as readonly string[]).includes(declaredMimeType)
  ) {
    return { error: 'invalidFileType' };
  }

  // 3. Get actual file info — size check BEFORE reading content
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) {
      return { error: 'fileNotFound' };
    }
    if (info.size > MAX_SHARE_FILE_SIZE) {
      return { error: 'fileTooLarge' };
    }
    if (info.size === 0) {
      return { error: 'fileEmpty' };
    }
    return { error: null, fileInfo: info as FileSystem.FileInfo & { exists: true } };
  } catch {
    return { error: 'fileAccessDenied' };
  }
}
```

**Why this matters:** Without this validation, the app is vulnerable to file bombs (OOM), MIME spoofing (server receives unexpected content), and potentially reading app-internal files.

---

### CRITICAL-2: Path traversal via file names — not sanitized in architecture

**Severity:** Critical
**Component:** `shareIntentService.ts` `handleIncomingFiles()` (architecture doc line 247), `SharedFilesPreview.tsx` (line 86)

**Architecture gap:** In `handleIncomingFiles()`, the filename is stored directly from the library: `fileName: raw.fileName ?? null`. No sanitization is applied. The architecture's Security Considerations section (line 744) claims "File names are sanitized via `sanitizeFilename()` before display or upload" but this never happens in the `handleIncomingFiles()` code.

**Exploit scenario:** A malicious app shares a file with `fileName: "../../databases/auth.db"`. The architecture stores this raw name in the `SharedFile` object. When `TransactionFormScreen` consumes files (architecture doc line 508), it passes `file.fileName` to `addAttachment()`, which calls `sanitizeFilename()` on the `name` parameter (useTransactionForm.ts line 151). **The existing form code does sanitize** — but:
1. The unsanitized name is displayed in `SharedFilesPreview` before the form processes it
2. If any future consumer of `SharedFile` skips `addAttachment()` and uses the filename directly, the traversal is live

**Current state:** The existing `sanitizeFilename()` in `sanitize.ts` (line 123) strips `/`, `\`, and null bytes. This MUST be applied in `handleIncomingFiles()`, not deferred to consumers.

**Required fix:**

```typescript
/**
 * Sanitize a shared file's name. Must be called immediately when
 * receiving the file, before any storage or display.
 */
export function sanitizeSharedFileName(rawName: string | null | undefined): string {
  if (!rawName) return `shared_${Date.now()}`;
  // Strip path separators, null bytes, and control characters
  let safe = rawName.replace(/[/\\\0\x01-\x1f]/g, '_');
  // Remove leading dots (prevents hidden files / directory traversal on Unix)
  safe = safe.replace(/^\.+/, '');
  // Cap length to prevent filesystem issues
  safe = safe.slice(0, 255);
  // Fallback if name is empty after sanitization
  return safe || `shared_${Date.now()}`;
}
```

**Note on SharedFilesPreview:** The component displays `file.fileName` directly in a `<Text>` element (line 86). React Native's `<Text>` is not vulnerable to XSS (unlike HTML), so this is safe for display. However, the name must still be sanitized before storage/upload.

---

### CRITICAL-3: Shared files must be copied to app sandbox — architecture explicitly skips this

**Severity:** Critical
**Component:** `shareIntentService.ts` — architecture design decision

**Architecture decision (doc line 744):** "No file content is persisted to disk by the share intent system. The OS-provided URIs are temporary and revoked when the app process dies."

**Architecture decision (doc line 265):** "Files are held in memory. If the app is killed before the user logs in, the share intent is lost."

**Why this is a security problem:** The architecture passes raw `content://` URIs from external apps directly to React Native `<Image>` components and eventually to `FormData` for upload. A `content://` URI is controlled by the source app:
1. **TOCTOU (time-of-check-time-of-use):** The source app validates a harmless JPEG, then swaps the content to malicious data before upload
2. **URI revocation:** The source app revokes the `content://` grant mid-upload, causing partial upload or crash
3. **Slow stream attack:** The `content://` provider returns data very slowly, blocking the upload thread indefinitely

**Required pattern:**

```typescript
/**
 * Copy a shared file to the app's cache directory.
 * This ensures we have our own copy that can't be revoked or modified.
 *
 * Must happen immediately after validation, before the file is
 * queued or displayed.
 */
async function copyToSandbox(
  sourceUri: string,
  sanitizedFileName: string,
): Promise<string> {
  const destDir = `${FileSystem.cacheDirectory}shared_receipts/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(destDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  }

  // Use a unique prefix to prevent collisions
  const destUri = `${destDir}${Date.now()}_${sanitizedFileName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  return destUri;
}
```

**Why sandbox copy is critical:**
- The queued `uri` in `SharedFile` becomes a local file URI we control
- No TOCTOU between validation and use
- Pre-auth queued files survive even if the source app revokes the `content://` URI
- The file can be safely displayed in `SharedFilesPreview` thumbnails

---

### HIGH-1: Pre-auth file storage must use private directory

**Severity:** High
**Component:** File queuing for unauthenticated users

**Exploit scenario:** If shared files are stored in a world-readable location (e.g., external storage), another app could read them. Financial receipts may contain sensitive information (account numbers, amounts, company details).

**Required:** Files must be stored in `FileSystem.cacheDirectory` (app-private on both Android and iOS). The `copyToSandbox` function above already does this. Do NOT use `FileSystem.documentDirectory` for temporary shared files — cache directory is appropriate because these are transient.

**Verify:** `expo-file-system`'s `cacheDirectory` maps to:
- Android: `/data/data/sa.ruqaqa.finance/cache/` (app-private)
- iOS: `Library/Caches/` (app-private)

Both are inaccessible to other apps.

---

### HIGH-2: Permission bypass — architecture correct, designer's code missing permissions prop

**Severity:** High
**Component:** `FlowSelectorSheet.tsx` (designer's code) vs `flowTargets.ts` (architecture)

**Architecture (correct):** The architecture defines `isAvailable: (p: UserPermissions) => boolean` on each flow target and the `FlowSelectorSheetProps` includes `permissions: UserPermissions`. Targets are filtered by `target.isAvailable(permissions)` (doc line 649).

**Designer's code (gap):** The current `FlowSelectorSheet.tsx` has hardcoded `enabled: true/false` (lines 48-68) and does NOT accept a `permissions` prop. The component's `FlowSelectorSheetProps` interface (line 21) has no `permissions` field.

**Required fix:** When the TDD agent implements the service, the `FlowSelectorSheet` must be updated to:
1. Accept `permissions: UserPermissions` as a prop
2. Accept `targets: ShareFlowTarget[]` from the registry (instead of hardcoding options)
3. Filter targets by `target.isAvailable(permissions)`
4. If zero targets are available after filtering, show an error and call `onDismiss`

This aligns the designer's code with the architecture's intent. The hardcoded options in the current component were placeholders.

**Note:** Client-side permission checks are UX-only (per CLAUDE.md), but they must still be present. The backend is the security boundary, but the mobile app should not offer flows the user can't complete.

---

### HIGH-3: File count limit bypass via share intent

**Severity:** High
**Component:** Share intent → transaction form attachment flow

**Exploit scenario:** The transaction form enforces `MAX_ATTACHMENTS = 4` (in `useTransactionForm.ts` line 148). If share intent files are injected into the form, they could bypass this limit if the service doesn't check against existing attachments.

**Required:** When routing shared files to the transaction form:
1. Check `existingAttachments.length + sharedFiles.length <= MAX_ATTACHMENTS`
2. If the combined count exceeds 4, only accept the first N files that fit
3. Show a warning to the user about truncated files

```typescript
function mergeSharedFilesIntoForm(
  existingCount: number,
  sharedFiles: SharedFile[],
  maxAttachments: number = 4,
): { accepted: SharedFile[]; rejected: number } {
  const available = maxAttachments - existingCount;
  if (available <= 0) return { accepted: [], rejected: sharedFiles.length };
  const accepted = sharedFiles.slice(0, available);
  const rejected = sharedFiles.length - accepted.length;
  return { accepted, rejected };
}
```

---

### HIGH-4: Memory exhaustion from large image thumbnails

**Severity:** High
**Component:** `SharedFilesPreview.tsx` (line 69)

**Current state:** The component loads images directly from URIs via `<Image source={{ uri: file.uri }}>`. For large images (e.g., 50MP camera photos), this can consume hundreds of MB of memory.

**Exploit scenario:** Share 4 large HEIC photos (each 20-40MB) simultaneously. The preview tries to decode all 4 full-resolution images for 64x64 thumbnails, potentially causing OOM.

**Recommended fix:** Use a thumbnail-generating approach:
1. After copying to sandbox, generate a small thumbnail (e.g., using `expo-image-manipulator` to resize to 128x128)
2. Store the thumbnail URI alongside the full file URI
3. Use the thumbnail URI in `SharedFilesPreview`, not the full-size URI

Alternatively, if `expo-image` (the library, not the picker) is available, it handles memory-efficient thumbnail rendering internally.

---

### MEDIUM-1: Stale file cleanup (conditional on CRITICAL-3 resolution)

**Severity:** Medium
**Component:** `shareIntentService.ts`

**If CRITICAL-3 sandbox copy is implemented:** Copied files in `${cacheDirectory}shared_receipts/` must be cleaned up. User shares files, opens app to login page, abandons login. Files remain in cache directory indefinitely.

**If CRITICAL-3 is deferred (architecture's current design):** In-memory URIs are lost when the app process dies — no stale file issue. However, `content://` URIs may hold open file descriptors that prevent the source app from cleaning up. Call `shareIntentStore.clear()` when the user navigates away from the pending state.

**Required cleanup (if sandbox copy is implemented):**
1. User dismisses the `SharePendingBanner` (calls `onDismiss`)
2. App startup — check for stale shared files older than 24 hours
3. After successful upload — delete sandbox copies

```typescript
async function cleanupStaleSharedFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const dir = `${FileSystem.cacheDirectory}shared_receipts/`;
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) return;

    const files = await FileSystem.readDirectoryAsync(dir);
    const now = Date.now();

    for (const file of files) {
      const filePath = `${dir}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && info.modificationTime) {
        const ageMs = now - info.modificationTime * 1000;
        if (ageMs > maxAgeMs) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }
    }
  } catch {
    // Cleanup failure is non-critical — files are in cache dir
    // which the OS can reclaim under storage pressure
  }
}
```

---

### MEDIUM-2: Race conditions — architecture's store uses replace semantics (no count limit)

**Severity:** Medium
**Component:** `shareIntentStore.ts` — `setFiles()` (architecture doc line 298)

**Architecture behavior:** The store's `setFiles()` replaces the current state entirely: `currentState = { status: 'files_received', files }`. This means a second share replaces the first batch. This is actually safer than appending (no unbounded growth), but there's no maximum file count check in the service layer.

**Scenario:** An app shares 20 files at once. The `handleIncomingFiles()` validates MIME type and size (with gaps noted in CRITICAL-1) but does not limit total file count. All 20 validated files enter the store.

**Required:** Add a max files cap in `handleIncomingFiles()` after the validation loop:

```typescript
// After the validation loop in handleIncomingFiles():
const MAX_SHARED_FILES = 10; // Gallery allows up to 10, strictest target (transaction) caps at 4

const capped = validated.slice(0, MAX_SHARED_FILES);
if (capped.length > 0) {
  shareIntentStore.setFiles(capped);
}
```

The per-target `maxFiles` limit (4 for transactions, 10 for gallery) is correctly enforced by each feature's form. But capping at the service level prevents storing an unreasonable number of files in memory.

---

### MEDIUM-3: Information leakage in logs

**Severity:** Medium
**Component:** `shareIntentService.ts` `handleIncomingFiles()` (architecture doc lines 236, 243)

**Architecture's logging:** The architecture uses `__DEV__` guards correctly (lines 208, 236, 243):
```typescript
if (__DEV__) console.warn('[ShareIntent] Rejected MIME:', mimeType);
if (__DEV__) console.warn('[ShareIntent] File too large:', fileSize);
```

**Good:** The `__DEV__` guard prevents production logging. **However**, even in dev mode, the rejected MIME type log at line 236 could leak file metadata. The MIME type itself is not sensitive, but the pattern of logging raw external data should be noted.

**Required for implementation:**
- Keep the `__DEV__` guards (already in architecture)
- Never log file URIs or file names, even in dev mode — they can contain sensitive info
- Log only counts and validation result codes

```typescript
if (__DEV__) {
  console.log(`[ShareIntent] Received ${rawFiles.length} files, ${validated.length} passed validation`);
}
// NEVER: console.log(`Received file: ${file.fileName} at ${file.uri}`);
```

---

### MEDIUM-4: handleIncomingFiles() is synchronous — cannot perform filesystem checks

**Severity:** Medium
**Component:** `shareIntentService.ts` `handleIncomingFiles()` (architecture doc line 223)

**Architecture gap:** The function signature is `function handleIncomingFiles(rawFiles: any[]): void` — synchronous. But proper file validation (checking actual file size via `FileSystem.getInfoAsync()`, copying to sandbox) requires async operations. The architecture's validation is limited to what's synchronously available from the library callback (`raw.fileSize`, `raw.mimeType`), which is untrusted data from the source app.

**Required:** Make `handleIncomingFiles()` async. The `ReceiveSharingIntent.getReceivedFiles()` callback can safely call an async function:

```typescript
ReceiveSharingIntent.getReceivedFiles(
  (files) => {
    // Fire and forget — errors handled inside
    handleIncomingFiles(files).catch((err) => {
      if (__DEV__) console.warn('[ShareIntent] Processing error');
    });
  },
  // ...
);

async function handleIncomingFiles(rawFiles: any[]): Promise<void> {
  // Now we can use FileSystem.getInfoAsync() for real size checks
  // and FileSystem.copyAsync() for sandbox copies
}
```

---

### LOW-1: UI overflow from long file names

**Severity:** Low
**Component:** `SharedFilesPreview.tsx` (line 86)

**Current state:** The component uses `numberOfLines={1}` for the document file name, which truncates correctly. This is already handled.

**No action needed.**

---

### LOW-2: Rapid repeated shares (DoS)

**Severity:** Low
**Component:** `shareIntentService.ts` (to be created)

**Scenario:** A malicious app rapidly triggers share intents to overwhelm the app.

**Mitigation:** The `MAX_SHARED_FILES` limit provides natural throttling. Additionally, debounce the share intent listener to collapse rapid events:

```typescript
// In the share intent listener setup, debounce with 500ms
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onShareReceived(files: SharedFile[]): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processSharedFiles(files);
  }, 500);
}
```

---

## Summary of Required Validations

The architecture's `handleIncomingFiles()` currently implements steps 2 and 4 (partially). The implementation **MUST** add the missing steps:

```
External Share
  │
  ├─ 1. Validate URI scheme (content:// or file:// only)
  ├─ 2. Validate declared MIME type against whitelist
  ├─ 3. Sanitize file name (strip path separators, control chars, leading dots)
  ├─ 4. Check file size BEFORE copying (reject >10MB or empty)
  ├─ 5. Copy to app sandbox (cache directory)
  ├─ 6. Enforce file count limit (max 4)
  ├─ 7. Store with sanitized metadata
  │
  └─ Queue ready for display / form attachment
```

Files that fail any step should be silently dropped with a user-facing toast showing the error type (e.g., "File too large" or "Unsupported file type"). Never show raw error details.

---

## Comparison: Existing Patterns to Reuse

| Existing pattern | Location | Reuse for share intent? |
|------------------|----------|------------------------|
| `sanitizeFilename()` | `sanitize.ts:123` | Yes — apply to all shared file names |
| `isAllowedMimeType()` | `sanitize.ts:129` | Yes — same MIME whitelist applies |
| `isWithinSizeLimit()` | `sanitize.ts:134` | Yes — same 10MB limit applies |
| `validateReceiptFile()` | `ReceiptPickerSection.tsx:41` | Partially — add URI scheme check, file existence check |
| `normalizeMediaUrl()` | `mediaUrl.ts:30` | No — share URIs are `content://`/`file://`, not HTTP URLs |

The share intent validation should import from the existing `sanitize.ts` where possible to maintain a single source of truth for validation constants (`ALLOWED_RECEIPT_MIME_TYPES`, `MAX_RECEIPT_FILE_SIZE`).

---

## Recommendations for Implementation (TDD agent / implementer)

The architecture doc (`docs/share-intent-architecture.md`) is a solid design. These are the security hardening steps needed when implementing:

1. **Make `handleIncomingFiles()` async** — The synchronous version can only check library-reported metadata. The async version can verify file size via `FileSystem.getInfoAsync()` and copy to sandbox (CRITICAL-1, MEDIUM-4)
2. **Add URI scheme validation** — Check `content://` or `file://` before processing (CRITICAL-1 Gap B)
3. **Always check file size via filesystem** — Don't trust `raw.fileSize` from the sharing library; call `FileSystem.getInfoAsync(uri, { size: true })` (CRITICAL-1 Gap A)
4. **Sanitize filename on receipt** — Call `sanitizeFilename()` in `handleIncomingFiles()`, not just in downstream consumers (CRITICAL-2)
5. **Copy to sandbox before storing in state** — Replace `content://` URIs with local `file://` URIs (CRITICAL-3). This is the most impactful security change vs the architecture's current design.
6. **Update `FlowSelectorSheet`** — Add `permissions` and `targets` props per architecture's `FlowSelectorSheetProps` (HIGH-2)
7. **Cap shared file count** — Add `MAX_SHARED_FILES` limit in `handleIncomingFiles()` (MEDIUM-2)
8. **Reuse existing constants** — Import `ALLOWED_RECEIPT_MIME_TYPES`, `MAX_RECEIPT_FILE_SIZE`, `sanitizeFilename` from existing modules
9. **Test the validation functions** — Each validation step should have unit tests with malicious inputs: path traversal filenames, oversize files, wrong MIME types, empty files, null URIs, non-http schemes
