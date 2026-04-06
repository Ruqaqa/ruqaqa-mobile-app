# Project Structure

This document describes the directory layout and file organization conventions for the Ruqaqa Finance Expo app.

**Path alias:** `@/` maps to `src/`

## Top-Level Layout

```
finance_mobile_expo/
├── app/                  # Expo Router file-based routes
├── assets/               # Static assets (images, fonts)
├── docs/                 # Architecture docs, design system, security reviews
├── modules/              # Local Expo native modules (e.g., expo-ffmpeg)
├── plugins/              # Expo config plugins
├── scripts/              # Dev/seed scripts
├── src/                  # Application source code
├── .maestro/             # Maestro E2E test flows
├── app.json              # Expo config
├── index.ts              # App entry point
├── jest.config.js        # Test configuration
├── tsconfig.json         # TypeScript config
├── CLAUDE.md             # AI assistant conventions
└── EXPO_MIGRATION_PLAN.md # Migration plan from Flutter
```

## app/ (Expo Router)

File-based routing. Each file defines a route.

```
app/
├── _layout.tsx           # Root layout: ThemeProvider > AuthProvider > VersionGate > SessionExpiredModal
├── index.tsx             # Auth gate: redirects to /login or /(app)
├── login.tsx             # SSO login screen (Keycloak)
├── auth/
│   └── callback.tsx      # OAuth redirect handler
└── (app)/
    ├── _layout.tsx       # Authenticated shell: Finance/Gallery module switcher
    └── index.tsx         # Module router
```

**Note:** `(app)/(finance)/` and `(app)/(gallery)/` are empty route groups. Actual screens are rendered by `FinanceShell` and `GalleryShell` in `src/navigation/`.

## src/ Directory

### src/features/

Feature-driven architecture. Each feature follows a consistent layout:

| Subdirectory | Purpose |
|---|---|
| `types.ts` | Domain types and constants |
| `components/` | Screens and UI components |
| `hooks/` | Feature-specific React hooks |
| `services/` | API calls, business logic, I/O operations |
| `utils/` | Pure functions: validation, sanitization, formatting |
| `__tests__/` | Unit tests (Jest) |

#### src/features/transactions/

Transaction history: CRUD, paginated list, advanced search/filters, receipt attachments, approval workflow, share intent integration.

```
transactions/
├── types.ts
├── components/
│   ├── TransactionHistoryScreen.tsx   # List orchestrator
│   ├── TransactionFormScreen.tsx      # Create form
│   ├── TransactionDetailSheet.tsx     # Bottom sheet detail view
│   ├── TransactionCard.tsx            # List item card
│   ├── TransactionList.tsx            # Paginated list
│   ├── TransactionFlowWidget.tsx      # Flow visualization
│   ├── ReceiptEditorScreen.tsx        # Receipt add/remove on submitted txns
│   ├── ReceiptPickerSection.tsx       # Attachment picker
│   ├── ReceiptThumbnails.tsx          # Receipt preview grid
│   ├── ReceiptUploadProgress.tsx      # Upload progress indicator
│   ├── ReceiptViewer.tsx              # Full-screen receipt viewer
│   ├── SearchModal.tsx                # Advanced search
│   ├── SubmissionPreviewDialog.tsx    # Pre-submit confirmation
│   ├── ApprovalActions.tsx            # Approve/reject buttons
│   ├── ApprovalStatusChips.tsx        # Status chips
│   └── FilterBar.tsx                  # Filter controls
├── hooks/
│   ├── useTransactionList.ts          # Pagination + filters + own/all
│   ├── useTransactionForm.ts          # Create form state
│   ├── useApprovalAction.ts           # Approve/reject mutation
│   └── useReceiptEditor.ts            # Receipt editor state
├── services/
│   ├── transactionService.ts          # API calls
│   ├── transactionSubmissionService.ts # Form submission logic
│   ├── receiptService.ts              # Receipt CRUD
│   ├── autocompleteSearchService.ts   # Search suggestions
│   ├── suggestionsService.ts          # Autocomplete
│   └── __tests__/
│       └── receiptService.test.ts
└── utils/
    ├── formatters.ts                  # Date/amount formatting
    ├── sanitize.ts                    # Input sanitization
    ├── transactionFormValidation.ts   # Form validation rules
    ├── receiptEditorHandlers.ts       # Receipt editor event handlers
    ├── receiptEditorPermissions.ts    # Permission checks
    └── sharedFilesAdapter.ts          # Share intent adapter (wraps generic)
```

#### src/features/reconciliation/

Reconciliation: 5-step form, paginated history, approval workflow.

```
reconciliation/
├── types.ts
├── components/
│   ├── ReconciliationHistoryScreen.tsx
│   ├── ReconciliationFormScreen.tsx
│   ├── ReconciliationDetailSheet.tsx
│   ├── ReconciliationCard.tsx
│   ├── ReconciliationList.tsx
│   ├── ReconciliationFlowWidget.tsx
│   ├── ReconciliationPreviewDialog.tsx
│   └── SearchModal.tsx
├── hooks/
│   ├── useReconciliationList.ts
│   ├── useReconciliationForm.ts
│   └── useApprovalAction.ts
├── services/
│   ├── reconciliationService.ts
│   └── reconciliationSubmissionService.ts
└── utils/
    ├── formValidation.ts
    ├── formatters.ts
    └── sanitize.ts
```

#### src/features/gallery/

Gallery: album browsing, media viewing, multi-select, download, upload, watermark editing, video processing.

```
gallery/
├── types.ts                           # All gallery types (albums, media, downloads, uploads, watermarks)
├── components/
│   ├── AlbumGridScreen.tsx            # Album list (2-column grid)
│   ├── AlbumDetailScreen.tsx          # Media grid inside album
│   ├── AlbumCard.tsx                  # Album card in grid
│   ├── AlbumOptionsSheet.tsx          # Album action menu
│   ├── CreateAlbumSheet.tsx           # Create album bottom sheet
│   ├── EditAlbumNameDialog.tsx        # Rename album
│   ├── FullScreenMediaViewer.tsx      # Pinch-zoom, swipe nav, video
│   ├── VideoPlayer.tsx                # Video playback (expo-video)
│   ├── MediaGrid.tsx                  # Paginated media grid
│   ├── MediaGridItem.tsx              # Grid item (image/video)
│   ├── SelectionHeader.tsx            # Multi-select header
│   ├── SelectionActionBar.tsx         # Bulk action buttons
│   ├── BulkManageSheet.tsx            # Tri-state album/tag assignment
│   ├── BulkDeleteConfirmDialog.tsx    # Confirm bulk delete
│   ├── DownloadFormatSheet.tsx        # Original vs watermarked
│   ├── DownloadProgressBar.tsx        # In-app download progress
│   ├── DuplicateSheet.tsx             # Duplicate detection decision
│   ├── UploadScreen.tsx               # Upload form + media picker
│   ├── UploadTabContainer.tsx         # Upload tab wrapper
│   ├── UploadProgressCard.tsx         # Per-item upload status
│   ├── MetadataPickerField.tsx        # Tag/project/album pickers
│   ├── SearchablePickerSheet.tsx      # Searchable bottom sheet
│   ├── WatermarkEditorScreen.tsx      # [Phase 6C] Full-screen watermark editor
│   ├── WatermarkEditorCanvas.tsx      # [Phase 6C] Canvas with draggable overlay
│   ├── WatermarkThumbnailStrip.tsx    # [Phase 6C] Horizontal thumbnail bar
│   └── OpacitySlider.tsx              # [Phase 6C] Custom opacity slider for watermark editor
├── hooks/
│   ├── useAlbumList.ts                # Album browsing + search
│   ├── useAlbumActions.ts             # Create/rename albums
│   ├── useAlbumMedia.ts               # Paginated media in album
│   ├── useMediaSelection.ts           # Multi-select (Set-based, O(1))
│   ├── useMediaBulkActions.ts         # Sequential bulk operations
│   ├── useDownload.ts                 # Download orchestration
│   ├── useUploadForm.ts               # Upload form state
│   ├── useUploadPipeline.ts           # Upload pipeline orchestrator
│   └── useWatermarkEditor.ts          # [Phase 6C] Watermark editor state
├── services/
│   ├── galleryService.ts              # Gallery API (albums, media, upload)
│   ├── uploadPipeline.ts              # Multi-item upload engine
│   ├── imageOptimizationService.ts    # Image compression (react-native-compressor)
│   ├── videoOptimizationService.ts    # Video compression + watermarking (FFmpeg single pass)
│   ├── fileHashService.ts             # SHA-256 dedup hashing
│   ├── downloadService.ts             # File download + media library save
│   ├── downloadQueue.ts               # FIFO queue (max 2 concurrent)
│   ├── downloadNotificationService.ts # Android notification for downloads
│   ├── watermarkApplicatorService.ts  # [Phase 6C] Image watermark compositing (Skia)
│   ├── watermarkSettingsService.ts    # [Phase 6C] API fetch + AsyncStorage persistence
│   └── videoProcessingNotificationService.ts  # [Phase 6D] FFmpeg progress notification
├── utils/
│   ├── mediaUrls.ts                   # URL normalization, full-res URL builder
│   ├── validation.ts                  # ObjectId validation, dedup, max cap
│   ├── parsers.ts                     # API response parsing
│   ├── watermarkCoordinates.ts        # [Phase 6C] Percentage-to-pixel coordinate math
│   ├── watermarkValidation.ts         # [Phase 6C] Draft clamping, URI validation
│   └── gallerySharedFilesAdapter.ts   # [Phase 6D] Share intent adapter for gallery
└── __tests__/
    ├── galleryService.test.ts
    ├── galleryServiceUpload.test.ts
    ├── galleryMediaService.test.ts
    ├── galleryValidation.test.ts
    ├── uploadPipeline.test.ts
    ├── imageOptimizationService.test.ts
    ├── videoOptimizationService.test.ts
    ├── fileHashService.test.ts
    ├── downloadService.test.ts
    ├── downloadQueue.test.ts
    ├── downloadNotificationService.test.ts
    ├── mediaUrls.test.ts
    ├── useAlbumList.test.ts
    ├── useAlbumActions.test.ts
    ├── useAlbumMedia.test.ts
    ├── useMediaSelection.test.ts
    ├── useMediaBulkActions.test.ts
    ├── useDownload.test.ts
    ├── useUploadForm.test.ts
    ├── useUploadPipeline.test.ts
    ├── watermarkCoordinates.test.ts   # [Phase 6C]
    ├── watermarkValidation.test.ts    # [Phase 6C]
    ├── watermarkApplicatorService.test.ts  # [Phase 6C]
    ├── watermarkSettingsService.test.ts    # [Phase 6C]
    ├── useWatermarkEditor.test.ts     # [Phase 6C]
    └── gallerySharedFilesAdapter.test.ts   # [Phase 6D]
```

### src/components/ (Shared)

Shared UI components organized by category. These are used across multiple features.

| Directory | Purpose |
|---|---|
| `ui/` | Generic primitives: Button, Input, Card, Badge, StatusChip, BottomSheet, SelectField, DatePickerField, AutocompleteField, CurrencyAmount, EmptyState, ErrorState, SkeletonCard, ProfileAvatar, SaudiRiyalSymbol, SegmentedControl |
| `finance/` | Shared finance components: PaginatedList, ApprovalActions, ApprovalStatusChips, DetailRow, AmountInput, FilterBar |
| `gallery/` | Shared gallery components: MediaThumbnail (auth-aware shimmer), AlbumMosaic (mosaic layout) |
| `layout/` | App chrome: AppBar, ModuleSwitcherSheet, NoAccessScreen, ErrorBoundary |
| `auth/` | SessionExpiredModal, LanguageSwitcher |
| `share/` | ShareIntentBridge, FlowSelectorSheet, SharedFilesPreview, SharePendingBanner |
| `version/` | VersionGate (forced/optional update + maintenance mode) |

### src/services/

App-wide services (not feature-specific).

```
services/
├── authService.ts           # Keycloak PKCE token exchange, refresh, logout
├── authContext.ts            # React context: session state, login/logout
├── apiClient.ts             # Axios: auto Bearer, proactive refresh, 401 retry
├── employeeService.ts       # Post-login employee validation
├── employeeCacheService.ts  # 24h cache-first employee list
├── financeChannelService.ts # 24h cache-first finance channel list
├── tokenStorage.ts          # expo-secure-store with chunking for large JWTs
├── permissionService.ts     # JWT role extraction, module/tab availability
├── versionCheckService.ts   # Forced/optional update, maintenance mode
├── soundService.ts          # Success sound playback (expo-audio)
├── appLifecycle.ts          # First-launch tracking (AsyncStorage)
├── config.ts                # Dev/prod URL config
├── errors.ts                # Typed error classes: NetworkError, AuthError
├── formCacheService.ts      # AsyncStorage cache for transaction form selections
├── keycloakDiscovery.ts     # OIDC endpoint construction
├── notificationConfig.ts    # Foreground notification display handler
├── shareIntent/             # Share intent subsystem (see below)
└── __tests__/               # Service unit tests
```

#### src/services/shareIntent/

Cross-cutting share intent system: receives files from other apps, routes to correct feature form.

```
shareIntent/
├── index.ts                 # Re-exports
├── shareIntentTypes.ts      # Types: SharedFile, ShareFlowTarget, ShareIntentState
├── shareIntentStore.ts      # 4-state machine (idle > files_received > flow_selected > idle)
├── shareIntentService.ts    # File reception and processing
├── shareIntentValidation.ts # MIME type, file size, filename validation
├── flowTargets.ts           # Extensible registry: Transaction, Reconciliation, Gallery
└── __tests__/
    ├── flowTargets.test.ts
    ├── shareIntentService.test.ts
    └── shareIntentStore.test.ts
```

### src/hooks/ (Global)

Hooks used across multiple features.

| Hook | Purpose |
|---|---|
| `useAppModule.ts` | Get/set current module (Finance/Gallery) via AppModuleContext |
| `usePagedList.ts` | Generic pagination hook (used by transactions + reconciliation) |
| `useShareIntent.ts` | Consume shared files from the share intent store |
| `useAuthHeaders.ts` | Auth headers for media requests with 30s auto-refresh |
| `useDoubleBackExit.ts` | Android double-back-to-exit pattern |

### src/navigation/

Module shell components and routing context.

| File | Purpose |
|---|---|
| `AppModuleContext.ts` | Context for Finance/Gallery module switching |
| `FinanceShell.tsx` | Finance module: tabs for Operations + Reconciliation |
| `GalleryShell.tsx` | Gallery module: tabs for Albums + Upload |

### src/utils/ (Global)

Shared pure utility functions.

| Utility | Purpose |
|---|---|
| `retry.ts` | `withRetry()` exponential backoff + `isRetryableError()` |
| `deduplicatedRefresh.ts` | `createDeduplicatedRefresh()` for concurrent call dedup |
| `colorUtils.ts` | `withAlpha(color, alpha)` for safe hex alpha |
| `formatters.ts` | Date, currency, plural formatting |
| `sanitize.ts` | `sanitizeText()`, `sanitizeFilters()`, `hasActiveFilters()` |
| `mediaUrl.ts` | Build media URLs with auth tokens |
| `sharedFilesAdapter.ts` | Generic SharedFile-to-ReceiptAttachment converter |

### src/types/

Shared type definitions used across features.

| File | Purpose |
|---|---|
| `auth.ts` | Auth session types |
| `permissions.ts` | UserPermissions interface (15 flags) |
| `shared.ts` | Cross-feature constants: APPROVAL_STATUSES, CURRENCIES, PAGE_SIZE |
| `version.ts` | Version check response types |

### src/i18n/

Internationalization (Arabic + English).

| File | Purpose |
|---|---|
| `index.ts` | i18next config + initialization |
| `en.ts` | English translations |
| `ar.ts` | Arabic translations |
| `DirectionProvider.tsx` | RTL context for bidirectional layout |

### src/theme/

Design system tokens.

| File | Purpose |
|---|---|
| `index.ts` | ThemeProvider + useTheme() hook |
| `colors.ts` | Light/dark color palettes |
| `typography.ts` | Font sizes, weights, line heights |
| `spacing.ts` | Spacing scale + border radius + shadows |

### src/__mocks__/

Jest mocks for native modules.

| File | Mocks |
|---|---|
| `expo-keep-awake.js` | expo-keep-awake |
| `expo-share-intent.js` | expo-share-intent |
| `fileMock.js` | Static file imports |
| `react-native-compressor.js` | react-native-compressor |

## modules/ (Local Expo Modules)

Local native Expo modules. Currently contains:

| Module | Purpose |
|---|---|
| `expo-ffmpeg/` | [Phase 6D] Custom FFmpeg module for GPU-accelerated video processing |

**Important:** The source of truth for expo-ffmpeg is `../expo-ffmpeg-module/`. All development and bug fixes must be made there first, then copied into `modules/expo-ffmpeg/`. Never edit the module directly inside this project.

## Other Top-Level Directories

| Directory | Purpose |
|---|---|
| `plugins/` | Expo config plugins (e.g., `withShareIntent.js`) |
| `scripts/` | Dev scripts (e.g., `seed-gallery.ts` for test data) |
| `.maestro/` | Maestro E2E test flows |
| `docs/` | Architecture docs, design system, security reviews |

## Conventions

### Where new files should go

| File type | Location |
|---|---|
| Feature screen/component | `src/features/{feature}/components/` |
| Feature hook | `src/features/{feature}/hooks/` |
| Feature API/business logic | `src/features/{feature}/services/` |
| Feature pure utils | `src/features/{feature}/utils/` |
| Feature tests | `src/features/{feature}/__tests__/` |
| Feature types | `src/features/{feature}/types.ts` (single file) |
| Shared UI component | `src/components/{category}/` |
| App-wide service | `src/services/` |
| App-wide hook | `src/hooks/` |
| App-wide utility | `src/utils/` |
| Cross-feature type | `src/types/` |
| Native module | `modules/{module-name}/` |

### services/ vs utils/ distinction

- **`services/`** — Has I/O, side effects, or platform API calls. Writes files, makes network requests, accesses storage, uses native modules.
- **`utils/`** — Pure, stateless transformers. Synchronous or trivially async. No side effects. Transforms data only.
