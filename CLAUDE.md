# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

Expo (React Native + TypeScript) mobile app for Ruqaqa employees. It's a migration from the Flutter app at `../finance_mobile/lib/` — that codebase is the source of truth for business logic, API contracts, validation rules, and edge cases.

App ID: `sa.ruqaqa.finance` | Version: 1.2.1 | Scheme: `ruqaqa://`

**Migration status:** Phases 0–6D complete (auth, permissions, transactions, reconciliation, gallery browsing/viewing/multi-select/download, upload pipeline, image optimization, watermark editor, image watermarking, FFmpeg dual-variant video processing, video watermark download, share intent, profile avatar initials, profile menu with signout). See `EXPO_MIGRATION_PLAN.md` for details.

## Commands

```bash
pnpm start              # Metro dev server (port 5173)
pnpm start --clear      # Metro with cache clear
pnpm android:build      # Build + install native APK on connected device
pnpm ios:build          # Build + install on iOS device/sim
pnpm android            # Start Metro for Android
pnpm ios                # Start Metro for iOS
pnpm test               # Jest unit tests
pnpm test -- src/services/__tests__/foo.test.ts  # Run single test file
pnpm test:e2e           # Clear app data, forward port, run all Maestro E2E tests
pnpm test:e2e:flow      # Run a specific Maestro flow file
pnpm seed:gallery       # Seed MongoDB with test gallery data (albums, tags, media)
pnpm seed:gallery:clean # Remove seeded test data
```

### Metro dev server

Metro runs on **port 5173** (not the default 8081). All scripts enforce this.

For Android physical devices connected via USB:
```bash
adb reverse tcp:5173 tcp:5173   # Forward Metro port to device
```

**Important:** Never use `adb shell pm clear sa.ruqaqa.finance` while Metro is running without re-running `adb reverse` — clearing app data drops the port forward and the app can't reconnect to Metro.

### First time / native rebuild

```bash
pnpm install
expo prebuild --clean           # Generates /android and /ios native dirs
pnpm android:build              # Build + install APK (requires prebuild)
```

Rebuild is needed after changing `app.json`, adding native plugins, or updating Expo SDK.

**Important:** `expo prebuild --clean` wipes `android/local.properties`. Restore it before building:
```bash
echo "sdk.dir=/Users/bassel/Library/Android/sdk" > android/local.properties
```

### Maestro E2E tests

Tests live in `.maestro/`. Env vars for login tests are in `.maestro/.env` (gitignored). See `/maestro-test` skill for conventions.

```bash
# Run a single flow with credentials
maestro test -e TEST_USERNAME=user -e TEST_PASSWORD=pass .maestro/keycloak-sso-login.yaml

# Run all flows
pnpm test:e2e
```

Key points:
- Use `- launchApp` without `clearState` or `clearKeychain` — both break Metro on dev builds
- Use standalone `- clearState: sa.ruqaqa.finance` before `- launchApp` when needed
- All `extendedWaitUntil` timeouts must be **10 seconds max**
- Wait for content first, then optionally skip version gate (not the other way around)
- Brave browser is the default on the test device (avoids Chrome's autofill/welcome issues)
- Minimize `optional: true` taps — each failed one wastes ~3-5s

## Architecture

### Routing (Expo Router, file-based)

- `app/_layout.tsx` — Root: ThemeProvider → AuthProvider → VersionGate → SessionExpiredModal
- `app/index.tsx` — Auth gate: redirects to `/login` or `/(app)` based on session
- `app/login.tsx` — SSO login (Microsoft + Keycloak buttons, no credential/password login)
- `app/auth/callback.tsx` — OAuth redirect handler
- `app/(app)/_layout.tsx` — Authenticated shell: Finance/Gallery module switcher with permission gating, ErrorBoundary around each shell

**Note:** `app/(app)/(finance)/` and `app/(app)/(gallery)/` are empty route groups. Actual screens are rendered by `FinanceShell` and `GalleryShell` in `src/navigation/`.

### Auth flow

1. `AuthProvider` (context) wraps entire app, restores session from secure storage on mount
2. SSO uses `expo-auth-session` with PKCE → opens Keycloak in system browser → redirect back via `ruqaqa://auth/callback`
3. `postLoginValidation()` pipeline: decode JWT → check `mobile_signin` role → extract permissions → validate employee via `employeeService.ts` (uses `apiClient`)
4. `apiClient.ts` (Axios): attaches Bearer token, proactively refreshes 30s before expiry, retries once on 401, uses `deduplicatedRefresh` to prevent concurrent refresh calls
5. Session expiration: shows `SessionExpiredModal` overlay → user acknowledges → clears state → redirects to login
6. Server logout: awaits Keycloak token revocation with retry, always clears local tokens

### Navigation shells

`app/(app)/_layout.tsx` uses an IndexedStack pattern — both `FinanceShell` and `GalleryShell` are always mounted (preserves state). Only the active module is displayed via `display: flex/none`.

- **FinanceShell**: tabs for Operations (Transaction History), Reconciliation
- **GalleryShell**: tabs for Albums, Upload
- Tabs are permission-gated via `getAvailableFinanceTabs()`
- Module switching via `ModuleSwitcherSheet` bottom sheet
- Context: `AppModuleContext` in `src/navigation/`

### Feature structure convention

Each feature under `src/features/` follows the same layout:
- `types.ts` — Domain types and constants
- `components/` — Screen + UI components
- `hooks/` — Feature-specific React hooks
- `services/` — API calls and business logic
- `utils/` — Validation, sanitization, formatters
- `__tests__/` — Unit tests

### Transaction History (Phase 3)

`src/features/transactions/` — Full CRUD with paginated list, advanced search/filters, receipt attachments (max 4), approval workflow, and share intent integration.

**Search fields:** statement, transaction number, partner employee, other party, client, project, amount range (min/max with +/- sign toggle), tax quarter/year, approval status, date range

**Key patterns:** `useTransactionList` hook manages pagination + filters + own/all toggle. `TransactionHistoryScreen` is the orchestrator component. `TransactionFormScreen` handles creation with receipt attachment. `TransactionDetailSheet` is a bottom sheet for viewing details. `ReceiptEditorScreen` allows adding/removing receipts on submitted transactions.

**Security:** All filter inputs sanitized before API calls. Error codes mapped to i18n strings (never raw API messages). `PAGE_SIZE` hardcoded. Backend: regex escaping on `contains` queries, limit capped at 100, page clamped ≥1.

### Reconciliation (Phase 4)

`src/features/reconciliation/` — Same patterns as transactions. 5-step creation form, paginated history, approval workflow, share intent integration.

**Form steps:** (1) Basic info — statement, amount, currency, date, bank fees (2) Type — salary, bonus, normal (3) Sender — entity type, finance channel, employee (4) Receiver — entity type, finance channel, employee (5) Additional — notes, file attachments, summary preview

**Key patterns:** `useReconciliationForm` manages multi-step form state. `useReconciliationList` mirrors transaction list hook. `ReconciliationFlowWidget` visualizes sender→receiver flow. 10-second preview with pause/resume before submission.

### Share intent

Cross-cutting concern — receives files from other apps and routes them to the correct feature form.

- `src/services/shareIntent/` — Core logic: 4-state machine (idle → files_received → flow_selected → idle), validation (MIME types, file size, filename), extensible flow target registry (Transaction, Reconciliation, Gallery)
- `src/components/share/` — UI: `ShareIntentBridge` (root integration), `FlowSelectorSheet` (choose target), `SharedFilesPreview`, `SharePendingBanner` (on login screen)
- `src/hooks/useShareIntent.ts` — Consumer hook
- Each feature has a `sharedFilesAdapter.ts` util to convert shared files to its attachment format

### Gallery (Phase 5)

`src/features/gallery/` — Album browsing, media viewing, multi-select with bulk actions, and download system.

**Album browsing:** 2-column grid with mosaic thumbnails, search, create/rename via bottom sheets. `useAlbumList` (debounced search, optimistic updates), `useAlbumActions` (create + rename). Default album is protected from rename/delete.

**Media viewing:** Paginated media grid inside albums (20/page, infinite scroll). Full-screen viewer with pinch-to-zoom (ZoomableImage), horizontal swipe navigation (RTL-aware), video playback (VideoPlayer via expo-video with `?token=` query param + Authorization header belt-and-suspenders auth — native players don't reliably forward custom HTTP headers). `useAlbumMedia` manages pagination. `useAuthHeaders` provides 30s auto-refresh auth headers for private media URLs.

**Multi-select & bulk actions:** Long-press to enter selection mode, select all/deselect. Bulk delete (permission-gated: `gallery_cms_delete`). Bulk manage sheet with tri-state UI for album assignment, tag assignment, project association. `useMediaSelection` (Set-based, O(1)), `useMediaBulkActions` (sequential processing with progress). Backend: `PUT /gallery/[id]/manage`.

**Download system:** Individual or bulk download with format selection (original vs watermarked). Downloads via `expo-media-library` with cache fallback. Android notification progress (sticky, replaced atomically). In-app `DownloadProgressBar`. `DownloadQueue` (max 2 concurrent, FIFO). Success sound on completion. Queue is in-memory only (no persistence across restarts).

**Key utils:** `mediaUrls.ts` (normalizeMediaUrl, getFullResMediaUrl), `validation.ts` (validateBulkIds — ObjectId validation, dedup, max 50 cap), `parsers.ts`.

### Gallery — Watermark & Video Processing (Phase 6C/6D)

**Watermark editor (6C):** Full-screen modal with interactive watermark positioning. `WatermarkEditorScreen` (orchestrator) → `WatermarkEditorCanvas` (draggable/resizable overlay with corner handles) + `WatermarkThumbnailStrip` (horizontal scroll, tap to switch items) + `OpacitySlider`. `useWatermarkEditor` manages per-item `WatermarkDraft` map, apply-to-all, reset defaults. Returns `Map<number, WatermarkDraft>` keyed by item index.

**Image watermarking (6C):** `watermarkApplicatorService.ts` composites logo overlay onto images using `@shopify/react-native-skia`. Reads source image + logo → draws on offscreen surface with opacity → encodes to JPEG temp file. Falls back to original on any error. Logo is cached after first load. `watermarkSettingsService.ts` fetches defaults from `GET /api/mobile/gallery/watermark-settings` with 5-minute in-memory cache + AsyncStorage persistence.

**Video processing (6D):** Dual-variant approach via `videoOptimizationService.ts`: `optimizeVideo()` (compress-only) + `watermarkVideo()` (watermark+compress), both from the **original source** to avoid double-encoding. GPU encoding: `h264_mediacodec` (Android), `h264_videotoolbox` (iOS), `libx264` (software fallback). Logo opacity pre-baked via Skia before FFmpeg (the binary only has `overlay`+`scale` filters; `format`+`colorchannelmixer` are not compiled in). Logo scale computed as `(videoWidth * widthPct / 100) / logoIntrinsicWidth` for correct video-relative sizing. Progress reported via FFmpeg statistics callback. `videoProcessingNotificationService.ts` shows sticky foreground notification during processing.

**Gallery share intent (6D):** `gallerySharedFilesAdapter.ts` converts `SharedFile[]` to `ImagePickerAsset[]` for the upload form. Gallery flow target enabled in `flowTargets.ts` with `image/*` + `video/*` MIME allowlist. `UploadTabContainer` consumes shared files via `useShareIntent()` hook.

**Pipeline integration:** `uploadPipeline.ts` orchestrates: images get Skia watermark between optimization and upload. Videos get two FFmpeg passes (compress → watermark+compress from original) then both files uploaded via `uploadItem({ fileUri, watermarkedFileUri })`. `galleryService.ts` appends `watermarkedFile` multipart field. `useUploadPipeline.ts` resolves bundled logo asset to local file URI via `expo-asset`. `noWatermarkNeeded` flag skips watermark pass per item. Video weight: 4.0 (1.5 compress + 1.3 watermark + 1.2 upload).

**Key utils:** `watermarkCoordinates.ts` (percentage-to-pixel conversion), `watermarkValidation.ts` (draft clamping, URI validation).

### Component library

`src/components/` is organized into categories:

| Directory | Purpose |
|-----------|---------|
| `ui/` | Generic primitives: Button, Input, Card, Badge, StatusChip, BottomSheet, SelectField, DatePickerField, AutocompleteField, CurrencyAmount, EmptyState, ErrorState, SkeletonCard, ProfileAvatar |
| `finance/` | Shared finance components reused by transactions & reconciliation: PaginatedList, ApprovalActions, ApprovalStatusChips, DetailRow, AmountInput, FilterBar |
| `layout/` | App chrome: AppBar, ModuleSwitcherSheet, NoAccessScreen, ErrorBoundary |
| `auth/` | SessionExpiredModal, LanguageSwitcher |
| `share/` | ShareIntentBridge, FlowSelectorSheet, SharedFilesPreview, SharePendingBanner |
| `gallery/` | MediaThumbnail (auth-aware with shimmer), AlbumMosaic (mosaic layout) |
| `version/` | VersionGate (forced/optional update + maintenance mode) |

### Services

| Service | Role |
|---------|------|
| `authService.ts` | Keycloak token exchange (PKCE), refresh, server logout with retry. Uses `withRetry()` from `utils/retry.ts` |
| `authContext.ts` | React context: session state, login/logout, AppState listener for foreground refresh. Uses `deduplicatedRefresh` to prevent timer/foreground race |
| `apiClient.ts` | Axios: auto Bearer, proactive refresh, 401 retry with dedup, `uploadMultipart()` helper |
| `employeeService.ts` | Validates employee via `apiClient` post-login |
| `employeeCacheService.ts` | 24-hour cache-first employee list for autocomplete fields |
| `financeChannelService.ts` | 24-hour cache-first finance channel list |
| `tokenStorage.ts` | `expo-secure-store` wrapper with chunking for large JWTs (1800-byte chunks), crash-safe write order (chunks first, count last) |
| `permissionService.ts` | Extracts 15 permission flags from JWT roles using `keycloakConfig.clientId`. `getAvailableModules()`, `getAvailableFinanceTabs()` |
| `versionCheckService.ts` | `/api/mobile/version-check` → forced update, optional update, maintenance mode. Download URL validated against trusted domains |
| `soundService.ts` | Success sound playback via `expo-audio` |
| `appLifecycle.ts` | First-launch tracking via AsyncStorage |
| `config.ts` | Dev/prod URLs keyed on `releaseChannel` from `app.json` |
| `errors.ts` | Typed error classes: `NetworkError`, `AuthError` |
| `formCacheService.ts` | AsyncStorage cache for last-selected client/project in transaction form |
| `keycloakDiscovery.ts` | Constructs all Keycloak OIDC endpoints from config (authorization, token, endSession, userinfo) |
| `notificationConfig.ts` | Configures `expo-notifications` foreground display handler (banner + list, no sound/badge) |
| `shareIntent/*` | Share intent state machine, validation, flow target registry (see share intent section) |

### Utilities

| Utility | Role |
|---------|------|
| `utils/retry.ts` | `withRetry()` exponential backoff + `isRetryableError()` (network/5xx) |
| `utils/deduplicatedRefresh.ts` | `createDeduplicatedRefresh()` — concurrent calls share one promise |
| `utils/colorUtils.ts` | `withAlpha(color, alpha)` — safe hex alpha application. Use this instead of `+ '1A'` concatenation |
| `utils/formatters.ts` | Date, currency, plural formatting |
| `utils/sanitize.ts` | `sanitizeText()`, `sanitizeFilters()`, `hasActiveFilters()` |
| `utils/mediaUrl.ts` | Build media URLs with auth tokens for private files |

### Theme & design system

`ThemeProvider` exposes `useTheme()` → `{ colors, typography, spacing, radius, shadows }`. Supports light/dark mode. Design derived from ruqaqa-website, documented in `docs/design-system.md`.

- Use theme tokens in styles, not raw values
- Use `start/end` instead of `left/right` for RTL support
- Use `withAlpha()` for transparent colors, not hex string concatenation
- Use `colors.onPrimary`/`colors.onSecondary`/`colors.onError` for text on colored backgrounds
- Accent Green (`#208f5a`) should appear as a supporting accent across all screens (not just login) to connect with the green logo

### i18n

`i18next` + `react-i18next`. Arabic and English with runtime switching. RTL applied via `I18nManager.forceRTL()`. Keys are camelCase: `t('signInWithMicrosoft')`. Strings in `src/i18n/en.ts` and `src/i18n/ar.ts`. `DirectionProvider` in `src/i18n/` handles RTL context.

### Global hooks

| Hook | Role |
|------|------|
| `useAppModule.ts` | Get/set current module (Finance/Gallery) via `AppModuleContext` |
| `usePagedList.ts` | Generic pagination hook — used by both `useTransactionList` and `useReconciliationList` |
| `useShareIntent.ts` | Consume shared files from the share intent store |
| `useAuthHeaders.ts` | Provides auth headers for authenticated media requests with 30s auto-refresh and stable reference |

### Testing

Unit tests use Jest with `jest-expo` preset. Run with `pnpm test`.

```bash
pnpm test                                    # Run all tests
pnpm test -- src/services/__tests__/foo.test.ts  # Run single file
```

Test files live next to source in `__tests__/` directories. Mock `expo-secure-store` with in-memory Map, mock `axios` with `axios-mock-adapter` for service tests, use `jest.useFakeTimers()` for timing tests, `renderHook` from `@testing-library/react-native` for hook tests.

### Shared types

`src/types/shared.ts` — Cross-feature constants: `APPROVAL_STATUSES`, `CURRENCIES`, `PAGE_SIZE` (20), `NOTES_MAX_LENGTH`, `FILTER_MAX_LENGTH`. Used by both transactions and reconciliation.

## Key references

- **Flutter source:** `../finance_mobile/lib/` — read this for exact API contracts, request/response shapes, validation, error handling
- **Migration plan:** `EXPO_MIGRATION_PLAN.md` — phases 0–8, business requirements, current status
- **Design system:** `docs/design-system.md` — colors, typography, spacing, component specs
- **Architecture docs:** `docs/architecture-transaction-history.md`, `docs/receipt-editor-architecture.md`, `docs/share-intent-architecture.md`
- **Security reviews:** `docs/receipt-editor-security-review.md`, `docs/share-intent-security-review.md`
- **API base:** dev `http://192.168.100.53:3000`, prod `https://ruqaqa.sa`. All mobile routes under `/api/mobile/`
- **Auth:** Keycloak at `auth.ruqaqa.sa`, realm `ruqaqa`, client `ruqaqa-mobile-app`

## Conventions

- Use **pnpm**, not npm
- Do not run build/deploy commands directly — give the command for the user to run
- TypeScript strict mode. Path alias: `@/` → `src/`
- Design system follows ruqaqa-website (not Flutter's old design)
- i18n keys in camelCase
- Client-side permission checks are UX-only — the backend is the security boundary
- New features should follow the feature structure convention (types, components, hooks, services, utils, tests)
- Shared finance UI goes in `src/components/finance/`, not duplicated per feature
- **expo-ffmpeg module** (custom FFmpeg module for video watermarking, compression, and GPU-accelerated encoding): The source of truth is `../expo-ffmpeg-module/`, NOT `modules/expo-ffmpeg/`. All development, bug fixes, and feature changes must be made in the original project first, verified there (build + device test), then copied into `modules/expo-ffmpeg/`. Never edit the module directly inside this project — it's a reusable module, not app-specific code.
