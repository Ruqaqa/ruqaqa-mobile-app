# Share Intent Architecture

Receiving files shared from external apps (gallery, file manager, WhatsApp, etc.) and routing them to the appropriate feature flow.

## Overview

When a user shares files TO this app, the system must:

1. Receive the files (cold launch or while running)
2. Validate file type/size
3. If not authenticated, queue files and show a banner on login screen
4. If authenticated, show a **Flow Selector** bottom sheet asking where to route the files
5. Route files to the selected feature (Transaction receipts, Reconciliation, Gallery album)

The Flutter implementation uses a singleton `ShareReceiptFlowService` that only routes to Transactions. The Expo version generalizes this with a flow selector to support multiple destinations.

---

## Data Flow

```
External App (Share)
        |
        v
[Native Layer: Android intent-filter / iOS Share Extension]
        |
        v
[react-native-receive-sharing-intent]
        |
        v
[ShareIntentService.handleIncoming()]
        |--- validate files (MIME, size)
        |--- store in shareIntentStore (zustand-like ref store)
        |
        v
   isAuthenticated?
    /           \
   NO            YES
   |              |
   v              v
[Login screen]  [FlowSelectorSheet]
[shows banner]   |--- Transaction (attach as receipts)
   |             |--- Reconciliation (Phase 4)
   |             |--- Gallery Album (Phase 6/7)
   |             |
   v             v
[After login]   [Navigate to selected flow with files]
[show FlowSelectorSheet]
```

---

## File Structure

```
src/
  services/
    shareIntent/
      shareIntentService.ts      # Core service: listen, validate, state management
      shareIntentTypes.ts        # SharedFile, ShareFlowTarget, ShareIntentState types
      shareIntentStore.ts        # In-memory store (module-level singleton, no React)
      flowTargets.ts             # Registry of available flow targets (extensible config array)
  components/
    share/
      FlowSelectorSheet.tsx      # Bottom sheet: "Where do you want to add this?"
      SharePendingBanner.tsx     # Banner shown on login screen when files are queued
  hooks/
    useShareIntent.ts            # React hook: subscribes to store, exposes state + actions
```

### Why this structure

- **`shareIntent/` directory under `services/`**: Groups related files without polluting the flat services folder. Follows the pattern of `features/transactions/services/`.
- **Store is a plain module, not React context**: Share intents arrive before React mounts (cold launch). A module-level store with subscriber pattern ensures no events are lost. React components subscribe via `useShareIntent()`.
- **`flowTargets.ts` is a config array**: Adding a new flow target (Reconciliation, Gallery) is a single object addition. No switch statements, no if/else chains.

---

## Types — `shareIntentTypes.ts`

```typescript
/** A file received via share intent from an external app. */
export interface SharedFile {
  /** Absolute file path (content:// URI on Android, file:// on iOS) */
  uri: string;
  /** MIME type reported by OS, e.g. 'image/jpeg', 'application/pdf' */
  mimeType: string;
  /** Derived category for display and routing logic */
  fileType: 'image' | 'document';
  /** Original filename if available */
  fileName: string | null;
  /** File size in bytes if available */
  fileSize: number | null;
}

/** Identifiers for features that can receive shared files. */
export type ShareFlowTargetId = 'transaction' | 'reconciliation' | 'gallery';

/** Configuration for a flow target shown in the selector. */
export interface ShareFlowTarget {
  id: ShareFlowTargetId;
  /** i18n key for the label */
  labelKey: string;
  /** i18n key for the description */
  descriptionKey: string;
  /** Lucide icon name */
  icon: string;
  /** Max files this target accepts */
  maxFiles: number;
  /** Allowed MIME types (null = accept all validated types) */
  allowedMimeTypes: readonly string[] | null;
  /** Permission check: returns true if user can access this flow */
  isAvailable: (permissions: UserPermissions) => boolean;
}

/** State machine for the share intent flow. */
export type ShareIntentState =
  | { status: 'idle' }
  | { status: 'files_received'; files: SharedFile[] }
  | { status: 'flow_selected'; files: SharedFile[]; targetId: ShareFlowTargetId }
  | { status: 'consumed' };
```

### State transitions

```
idle ──[handleIncoming]──> files_received
files_received ──[selectFlow]──> flow_selected
flow_selected ──[consumeFiles]──> idle
files_received ──[dismiss/clear]──> idle
any ──[clear]──> idle
```

---

## Flow Targets Registry — `flowTargets.ts`

```typescript
import { ShareFlowTarget } from './shareIntentTypes';
import { UserPermissions } from '@/types/permissions';
import { ALLOWED_MIME_TYPES } from '@/features/transactions/components/ReceiptPickerSection';

/**
 * Registry of features that can receive shared files.
 * To add a new target: append an object to this array.
 * The FlowSelectorSheet renders these in order, filtered by isAvailable().
 */
export const SHARE_FLOW_TARGETS: ShareFlowTarget[] = [
  {
    id: 'transaction',
    labelKey: 'shareFlowTransaction',
    descriptionKey: 'shareFlowTransactionDesc',
    icon: 'Receipt',
    maxFiles: 4,
    allowedMimeTypes: ALLOWED_MIME_TYPES as unknown as string[],
    isAvailable: (p: UserPermissions) => p.canCreateTransactions,
  },
  {
    id: 'reconciliation',
    labelKey: 'shareFlowReconciliation',
    descriptionKey: 'shareFlowReconciliationDesc',
    icon: 'ArrowLeftRight',
    maxFiles: 4,
    allowedMimeTypes: null, // inherits global validation
    isAvailable: (p: UserPermissions) => p.canCreateReconciliation,
  },
  {
    id: 'gallery',
    labelKey: 'shareFlowGallery',
    descriptionKey: 'shareFlowGalleryDesc',
    icon: 'ImagePlus',
    maxFiles: 10,
    allowedMimeTypes: null,
    isAvailable: (p: UserPermissions) => p.canCreateGallery,
  },
];
```

**Extensibility**: Adding a future target (e.g., "Expense Report") means appending one object. No other files need modification — the FlowSelectorSheet, validation, and routing all read from this array.

---

## Core Service — `shareIntentService.ts`

```typescript
import ReceiveSharingIntent from 'react-native-receive-sharing-intent';
import { SharedFile, ShareIntentState, ShareFlowTargetId } from './shareIntentTypes';
import { shareIntentStore } from './shareIntentStore';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/features/transactions/components/ReceiptPickerSection';

// Global validation constants (superset across all targets)
const GLOBAL_ALLOWED_MIME_TYPES: readonly string[] = ALLOWED_MIME_TYPES;
const GLOBAL_MAX_FILE_SIZE = MAX_FILE_SIZE_BYTES; // 10 MB

/**
 * Initialize share intent listeners.
 * Call once at app startup (in app/_layout.tsx bootstrap).
 * Handles both cold-launch intents and intents received while running.
 */
export function initShareIntentListeners(): void {
  // Cold launch: app opened via share
  ReceiveSharingIntent.getReceivedFiles(
    (files) => handleIncomingFiles(files),
    (error) => {
      if (__DEV__) console.warn('[ShareIntent] Error receiving files:', error);
    },
  );
}

/**
 * Clean up listeners. Call on app unmount.
 */
export function cleanupShareIntentListeners(): void {
  ReceiveSharingIntent.clearReceivedFiles();
}

/**
 * Process incoming shared files: validate and store.
 */
function handleIncomingFiles(rawFiles: any[]): void {
  if (!rawFiles || rawFiles.length === 0) return;

  const validated: SharedFile[] = [];

  for (const raw of rawFiles) {
    const mimeType = raw.mimeType ?? raw.type ?? '';
    const uri = raw.contentUri ?? raw.filePath ?? '';

    if (!uri) continue;

    // MIME type validation
    if (!GLOBAL_ALLOWED_MIME_TYPES.includes(mimeType)) {
      if (__DEV__) console.warn('[ShareIntent] Rejected MIME:', mimeType);
      continue;
    }

    // File size validation (if available)
    const fileSize = raw.fileSize ?? raw.size ?? null;
    if (fileSize != null && fileSize > GLOBAL_MAX_FILE_SIZE) {
      if (__DEV__) console.warn('[ShareIntent] File too large:', fileSize);
      continue;
    }

    validated.push({
      uri,
      mimeType,
      fileType: mimeType.startsWith('image/') ? 'image' : 'document',
      fileName: raw.fileName ?? null,
      fileSize,
    });
  }

  if (validated.length > 0) {
    shareIntentStore.setFiles(validated);
  }
}
```

### Design decisions

1. **Validation at entry**: Files are validated once on receipt (not deferred to each target). Targets can further restrict via `allowedMimeTypes` in their config.
2. **No async storage for queuing**: Files are held in memory. If the app is killed before the user logs in, the share intent is lost — this matches the Flutter behavior and avoids stale file references. The OS re-delivers the intent on next launch attempt.
3. **`ReceiveSharingIntent` handles both cold + warm**: The library fires the callback for the initial intent and subsequent ones via the same API.

---

## In-Memory Store — `shareIntentStore.ts`

A lightweight pub/sub store outside React. Ensures events from native layer (which fire before React tree mounts) are not lost.

```typescript
import { SharedFile, ShareIntentState, ShareFlowTargetId } from './shareIntentTypes';

type Listener = (state: ShareIntentState) => void;

let currentState: ShareIntentState = { status: 'idle' };
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(currentState);
  }
}

export const shareIntentStore = {
  getState(): ShareIntentState {
    return currentState;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setFiles(files: SharedFile[]): void {
    currentState = { status: 'files_received', files };
    notify();
  },

  selectFlow(targetId: ShareFlowTargetId): void {
    if (currentState.status !== 'files_received') return;
    currentState = { status: 'flow_selected', files: currentState.files, targetId };
    notify();
  },

  /**
   * Consume pending files for a target. Returns the files and resets to idle.
   * The consumer (e.g., TransactionFormScreen) calls this once to claim the files.
   */
  consumeFiles(): SharedFile[] {
    if (currentState.status !== 'flow_selected' && currentState.status !== 'files_received') {
      return [];
    }
    const files = currentState.files;
    currentState = { status: 'idle' };
    notify();
    return files;
  },

  clear(): void {
    currentState = { status: 'idle' };
    notify();
  },
};
```

### Why not React Context / Zustand / AsyncStorage

- **React Context**: Share intents arrive via native callbacks before the React tree mounts. A context provider would miss events during the gap between native init and React render.
- **Zustand**: Would work, but adding a dependency for ~40 lines of pub/sub is unnecessary. The store is internal to the share intent feature.
- **AsyncStorage**: File URIs from share intents are temporary. They may become invalid if the app restarts. Persisting them creates a false promise of durability. The Flutter app also uses in-memory-only storage.

---

## React Hook — `useShareIntent.ts`

```typescript
import { useSyncExternalStore, useCallback } from 'react';
import { shareIntentStore } from '@/services/shareIntent/shareIntentStore';
import { ShareIntentState, ShareFlowTargetId, SharedFile } from '@/services/shareIntent/shareIntentTypes';

/**
 * Subscribe to share intent state from React components.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useShareIntent() {
  const state: ShareIntentState = useSyncExternalStore(
    shareIntentStore.subscribe,
    shareIntentStore.getState,
  );

  const hasPendingFiles = state.status === 'files_received' || state.status === 'flow_selected';

  const pendingFiles: SharedFile[] =
    state.status === 'files_received' || state.status === 'flow_selected'
      ? state.files
      : [];

  const selectFlow = useCallback((targetId: ShareFlowTargetId) => {
    shareIntentStore.selectFlow(targetId);
  }, []);

  const consumeFiles = useCallback(() => {
    return shareIntentStore.consumeFiles();
  }, []);

  const clear = useCallback(() => {
    shareIntentStore.clear();
  }, []);

  return {
    state,
    hasPendingFiles,
    pendingFiles,
    pendingFileCount: pendingFiles.length,
    selectFlow,
    consumeFiles,
    clear,
  };
}
```

---

## Integration Points

### 1. App Startup — `app/_layout.tsx`

Initialize the native listener in the bootstrap function, before React renders:

```typescript
// In RootLayout's bootstrap():
import { initShareIntentListeners, cleanupShareIntentListeners } from '@/services/shareIntent/shareIntentService';

useEffect(() => {
  async function bootstrap() {
    await initI18n();
    initShareIntentListeners(); // <-- add here
    setReady(true);
    SplashScreen.hideAsync();
  }
  bootstrap();

  return () => cleanupShareIntentListeners();
}, []);
```

### 2. Login Screen — `app/login.tsx`

Show a banner when files are pending and user is not yet authenticated:

```tsx
import { useShareIntent } from '@/hooks/useShareIntent';
import { SharePendingBanner } from '@/components/share/SharePendingBanner';

// Inside LoginScreen:
const { hasPendingFiles, pendingFileCount } = useShareIntent();

// In JSX, between the top bar and error banner:
{hasPendingFiles && (
  <SharePendingBanner fileCount={pendingFileCount} />
)}
```

The banner is informational only — "Sign in to attach N file(s)". No dismiss action; files are processed after login.

### 3. Auth Gate — `app/(app)/_layout.tsx`

After authentication, check for pending files and show the FlowSelectorSheet:

```tsx
import { useShareIntent } from '@/hooks/useShareIntent';
import { FlowSelectorSheet } from '@/components/share/FlowSelectorSheet';
import { SHARE_FLOW_TARGETS } from '@/services/shareIntent/flowTargets';

// Inside AppLayout:
const { hasPendingFiles, pendingFiles, selectFlow, clear } = useShareIntent();
const [flowSelectorVisible, setFlowSelectorVisible] = useState(false);

// Show flow selector when files arrive (either on mount after login, or while running)
useEffect(() => {
  if (hasPendingFiles) {
    setFlowSelectorVisible(true);
  }
}, [hasPendingFiles]);

const handleFlowSelect = (targetId: ShareFlowTargetId) => {
  selectFlow(targetId);
  setFlowSelectorVisible(false);
  // Navigation to the target screen happens via state subscription in the target shell
};

const handleFlowDismiss = () => {
  clear();
  setFlowSelectorVisible(false);
};

// In JSX:
<FlowSelectorSheet
  visible={flowSelectorVisible}
  targets={SHARE_FLOW_TARGETS}
  permissions={effectivePermissions}
  fileCount={pendingFiles.length}
  onSelect={handleFlowSelect}
  onDismiss={handleFlowDismiss}
/>
```

### 4. FinanceShell — `src/navigation/FinanceShell.tsx`

When the flow target is `transaction`, auto-open the TransactionFormScreen:

```tsx
import { useShareIntent } from '@/hooks/useShareIntent';

// Inside FinanceShell:
const { state } = useShareIntent();

// Auto-open form when share targets transactions
useEffect(() => {
  if (state.status === 'flow_selected' && state.targetId === 'transaction') {
    setFormVisible(true);
  }
}, [state]);
```

### 5. TransactionFormScreen — `src/features/transactions/components/TransactionFormScreen.tsx`

Consume shared files as pre-attached receipts when the form opens:

```tsx
import { useShareIntent } from '@/hooks/useShareIntent';

// Inside TransactionFormScreen:
const { state, consumeFiles } = useShareIntent();

// On mount, check for pending shared files targeted at transactions
useEffect(() => {
  if (state.status === 'flow_selected' && state.targetId === 'transaction') {
    const sharedFiles = consumeFiles();
    for (const file of sharedFiles) {
      addAttachment(
        file.uri,
        file.fileType,
        file.fileName ?? `shared_${Date.now()}.${file.mimeType.split('/')[1] ?? 'jpg'}`,
        file.mimeType,
        file.fileSize ?? undefined,
      );
    }
  }
}, []); // Run once on mount
```

This mirrors the Flutter pattern in `transaction_form_page.dart:_checkForSharedReceipts()`.

### 6. Future Flows (Reconciliation, Gallery)

When Phase 4/6 are implemented, each feature screen follows the same pattern:

```tsx
// In ReconciliationFormScreen (Phase 4):
const { state, consumeFiles } = useShareIntent();
useEffect(() => {
  if (state.status === 'flow_selected' && state.targetId === 'reconciliation') {
    const files = consumeFiles();
    // attach to reconciliation form
  }
}, []);
```

No changes to the share intent service, store, or flow selector are needed. The target is already registered in `flowTargets.ts`.

---

## Native Configuration

### Android — Expo Config Plugin

The `react-native-receive-sharing-intent` library requires intent filters in `AndroidManifest.xml`. With Expo managed workflow, this is done via the library's built-in config plugin or a custom one.

Required intent filters (mirroring Flutter):

```xml
<!-- Single image share -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>

<!-- Multiple image share -->
<intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>

<!-- Single PDF share -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/pdf" />
</intent-filter>

<!-- Multiple PDF share -->
<intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/pdf" />
</intent-filter>
```

In `app.json`, add the plugin:

```json
{
  "plugins": [
    ["react-native-receive-sharing-intent", {
      "iosActivationRules": {
        "NSExtensionActivationSupportsImageWithMaxCount": 4,
        "NSExtensionActivationSupportsFileWithMaxCount": 4
      }
    }]
  ]
}
```

After adding the plugin: `expo prebuild --clean` is required to regenerate native projects.

### iOS — Share Extension

The library auto-generates an iOS Share Extension via its config plugin. Key settings:

- **Activation rules**: Max 4 images, max 4 files (matching transaction limit)
- **App group**: Shared container for passing files from the extension to the main app
- **Bundle ID**: `sa.ruqaqa.app.ShareExtension`

---

## FlowSelectorSheet Component

A bottom sheet modal rendered in `app/(app)/_layout.tsx`:

```
+------------------------------------------+
|            [handle bar]                   |
|                                           |
|   Where do you want to add these files?   |
|   2 files selected                        |
|                                           |
|   +------------------------------------+  |
|   | [Receipt icon]                     |  |
|   | New Transaction                    |  |
|   | Attach as receipt(s)               |  |
|   +------------------------------------+  |
|                                           |
|   +------------------------------------+  |
|   | [ArrowLeftRight icon]              |  |  <- dimmed if no permission
|   | Reconciliation                     |  |
|   | Attach to reconciliation           |  |
|   +------------------------------------+  |
|                                           |
|   +------------------------------------+  |
|   | [ImagePlus icon]                   |  |
|   | Gallery Album                      |  |
|   | Upload to album                    |  |
|   +------------------------------------+  |
|                                           |
|   [Cancel]                                |
+------------------------------------------+
```

**Props:**
```typescript
interface FlowSelectorSheetProps {
  visible: boolean;
  targets: ShareFlowTarget[];
  permissions: UserPermissions;
  fileCount: number;
  onSelect: (targetId: ShareFlowTargetId) => void;
  onDismiss: () => void;
}
```

**Behavior:**
- Filters `targets` by `target.isAvailable(permissions)` — unavailable targets are hidden entirely (not dimmed)
- If only one target is available, auto-select it (skip the sheet)
- If zero targets are available, show an error message and clear the files
- Uses the same `Modal + backdrop + sheet` pattern as `ModuleSwitcherSheet` and `ReceiptPickerSection`

---

## SharePendingBanner Component

Shown on the login screen when files are pending:

```
+------------------------------------------+
| [Paperclip]  2 file(s) ready to attach   |
|              Sign in to continue          |
+------------------------------------------+
```

**Props:**
```typescript
interface SharePendingBannerProps {
  fileCount: number;
}
```

Styling: Uses `withAlpha(colors.green, 0.1)` background with `colors.green` text — matching the brand accent color convention. Follows the same pattern as the error banner in `login.tsx`.

---

## Sequence Diagrams

### Happy path: User is authenticated

```
User shares image from Gallery app
  -> OS delivers intent to Ruqaqa app
  -> shareIntentService.handleIncomingFiles()
  -> shareIntentStore.setFiles([file])          -- state: files_received
  -> useShareIntent() in AppLayout fires effect
  -> FlowSelectorSheet opens
  -> User taps "New Transaction"
  -> shareIntentStore.selectFlow('transaction')  -- state: flow_selected
  -> FinanceShell detects target, opens form modal
  -> TransactionFormScreen mounts
  -> consumeFiles() returns files                -- state: idle
  -> addAttachment() for each file
  -> Form shows pre-attached receipts
```

### Pre-auth path: User is NOT authenticated

```
User shares image from Gallery app (app was not running)
  -> OS launches app, delivers intent
  -> bootstrap() calls initShareIntentListeners()
  -> shareIntentService.handleIncomingFiles()
  -> shareIntentStore.setFiles([file])           -- state: files_received
  -> AuthProvider restores session -> not authenticated
  -> Redirect to /login
  -> LoginScreen mounts, useShareIntent() reads state
  -> SharePendingBanner shows "1 file ready to attach"
  -> User logs in
  -> Redirect to /(app)
  -> AppLayout mounts, detects hasPendingFiles
  -> FlowSelectorSheet opens
  -> (continues as happy path above)
```

### Dismiss / cancel

```
  -> FlowSelectorSheet opens
  -> User taps backdrop or Cancel
  -> shareIntentStore.clear()                    -- state: idle
  -> Files are discarded (user can re-share)
```

---

## Validation Rules

| Rule | Value | Enforced at |
|------|-------|-------------|
| Allowed MIME types | image/jpeg, image/png, image/heic, image/webp, application/pdf | `shareIntentService.handleIncomingFiles()` |
| Max file size | 10 MB (10 * 1024 * 1024 bytes) | `shareIntentService.handleIncomingFiles()` |
| Max files per transaction | 4 | `useTransactionForm.addAttachment()` (existing) |
| Max files per gallery upload | 10 | `flowTargets.ts` config (enforced by Gallery form) |
| Filename sanitization | Strip `/`, `\`, `\0` | `sanitizeFilename()` (existing in ReceiptPickerSection) |

Files that fail validation at the service level are silently dropped (with a dev-mode console warning). This prevents invalid files from ever entering the store. The per-target `maxFiles` limit is enforced by each feature's form, not the share intent service — the service is a transport layer.

---

## Security Considerations

1. **File URI trust**: Content URIs from the OS are treated as untrusted. File names are sanitized via `sanitizeFilename()` before display or upload.
2. **No path traversal**: File URIs are passed directly to `FormData` for upload — they are never used to construct local file paths for reading/writing.
3. **MIME type validation**: Double validation — once at the share intent service level (global), once at the feature level (target-specific via existing `validateReceiptFile()`).
4. **Memory-only storage**: No file content is persisted to disk by the share intent system. The OS-provided URIs are temporary and revoked when the app process dies.
5. **Permission gating**: Flow targets are filtered by `isAvailable()` which checks `UserPermissions`. This is UX-only — the backend is the security boundary (as per project convention).

---

## i18n Keys

Add to `src/i18n/en.ts` and `src/i18n/ar.ts`:

```typescript
// en.ts
shareFlowTitle: 'Where do you want to add these files?',
shareFlowFilesSelected: '{{count}} file(s) selected',
shareFlowTransaction: 'New Transaction',
shareFlowTransactionDesc: 'Attach as receipt(s)',
shareFlowReconciliation: 'Reconciliation',
shareFlowReconciliationDesc: 'Attach to reconciliation',
shareFlowGallery: 'Gallery Album',
shareFlowGalleryDesc: 'Upload to album',
shareFlowCancel: 'Cancel',
shareFlowNoTargets: 'No available options for these files',
sharePendingBanner: '{{count}} file(s) ready to attach',
sharePendingSignIn: 'Sign in to continue',
```

---

## Package Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `react-native-receive-sharing-intent` | Native share intent handling for Android + iOS | Has Expo config plugin. Requires `expo prebuild --clean` |

No other new dependencies. The architecture uses `useSyncExternalStore` (React 18+, already available), existing theme/i18n/permission infrastructure.

---

## Testing Strategy

### Unit tests

| Test file | What it covers |
|-----------|---------------|
| `src/services/shareIntent/__tests__/shareIntentStore.test.ts` | State transitions: idle -> files_received -> flow_selected -> consumed -> idle. Edge cases: consume when idle, double setFiles, clear from any state |
| `src/services/shareIntent/__tests__/shareIntentService.test.ts` | Validation: reject bad MIME, reject oversized, accept valid. Parse raw file objects from library |
| `src/services/shareIntent/__tests__/flowTargets.test.ts` | Permission gating: each target's `isAvailable()` returns correct boolean for permission combos |
| `src/hooks/__tests__/useShareIntent.test.ts` | Hook returns correct state, hasPendingFiles, pendingFileCount. Responds to store changes |

### Integration tests (Maestro E2E)

Share intent testing via Maestro is limited (Maestro cannot trigger OS-level share intents). Manual testing approach:

1. Open Gallery app, select image, tap Share, select Ruqaqa
2. Verify FlowSelectorSheet appears (if authenticated)
3. Tap "New Transaction", verify image appears as attachment
4. Repeat while logged out — verify banner, then post-login flow

---

## Migration Notes from Flutter

| Flutter | Expo |
|---------|------|
| `receive_sharing_intent` (Dart package) | `react-native-receive-sharing-intent` (RN package) |
| `ShareReceiptFlowService` (singleton + ChangeNotifier) | `shareIntentStore` (module-level pub/sub) + `useShareIntent` hook |
| `SharedReceiptFile` data class | `SharedFile` TypeScript interface |
| Three states: idle / filesReceived / filesAttached | Four states: idle / files_received / flow_selected / consumed |
| Direct-to-transaction routing | FlowSelectorSheet with extensible targets |
| Banner in `LoginPage` via `ChangeNotifier` | `SharePendingBanner` via `useShareIntent()` hook |
| `consumePendingFiles()` in `_checkForSharedReceipts()` | `consumeFiles()` in `useEffect` on form mount |
| AndroidManifest manual edit | Expo config plugin (auto-generated via prebuild) |

The key architectural difference: Flutter routes directly to Transactions (the only consumer). Expo introduces the FlowSelectorSheet because Reconciliation and Gallery will also consume shared files in later phases. The extra `flow_selected` state enables this routing without the service needing to know about navigation.
