# Ruqaqa Finance Mobile: Flutter to Expo Migration Plan

**Project location:** `finance_mobile_expo/`
**Flutter source (business logic reference):** `../finance_mobile/lib/`

## Current State

The Flutter app (`finance_mobile`) is a financial management mobile app for Ruqaqa employees. It has 5 feature domains: Transactions, Reconciliation, Gallery, Permissions, and Main Navigation. It authenticates via Keycloak SSO, communicates with the Payload CMS backend at `ruqaqa.sa/api/mobile/*`, and supports Arabic/English with full RTL.

The implementing AI should refer to the Flutter codebase at `finance_mobile/lib/` for exact business logic, API contracts, validation rules, and UI behavior.

---

## Expo Limitations & Risks

Before starting, be aware of these constraints:

### High Risk

| Area | Problem |
|------|---------|
| **Video watermarking** | FFmpegKit (the primary FFmpeg wrapper for React Native) was archived/retired in June 2025. There is no well-maintained unified library for applying watermarks to videos. Community forks exist but have uncertain futures. Image watermarking is fine. |
| **Background file processing** | React Native has no equivalent to Dart isolates. Heavy computation (file hashing, compression pipelines) blocks the JS thread. Native modules or JSI are needed for parallel processing, but the DX is significantly worse. |

### Medium Risk

| Area | Problem |
|------|---------|
| **Secure storage size limit** | `expo-secure-store` has a ~2048-byte value limit on some iOS versions. Keycloak JWTs with rich role claims can exceed this. Use `@neverdull-agency/expo-unlimited-secure-store` or split tokens. |
| **Android Downloads folder** | Writing to the public Downloads directory requires SAF permission prompts in Expo, unlike Flutter where you get direct path access. This adds UX friction for downloads. |
| **Development build required** | 10+ features need a development build (not Expo Go). You lose the "scan QR to test" workflow from day one. Use `expo prebuild` and EAS Build. |

### Low Risk (Good Support)

Keycloak OAuth, image compression, cached images, localization/RTL, share intents, multipart uploads, media scanner, local notifications — all have good Expo equivalents.

### Recommendation on Video Watermarking

Since video watermarking has no reliable client-side solution in React Native, consider moving video watermark application to the **server side** (the Payload backend already processes uploads). The mobile app would only handle image watermarking client-side. This architectural change would eliminate the highest-risk item.

---

## Migration Phases

### Phase 0: Project Scaffolding & Infrastructure — DONE

**Goal:** Set up the Expo project with the foundational layers that every feature depends on.

**Completed:**
- Expo project initialized with TypeScript, targeting Android and iOS
- Navigation: module switcher (Finance vs Gallery), tab navigation within Finance (Operations, Reconciliation), Gallery (Albums, Upload) — all permission-gated
- Design system based on ruqaqa-website (not Flutter): documented in `docs/design-system.md`, implemented in `src/theme/`
- Arabic/English localization with runtime switching and RTL support: `src/i18n/`
- Authenticated HTTP client with auto Bearer token, proactive refresh, 401 retry, multipart upload: `src/services/apiClient.ts`
- Secure token storage with chunking for large Keycloak JWTs: `src/services/tokenStorage.ts`
- Permission service with JWT role extraction: `src/services/permissionService.ts`
- Core UI components (Button, Input, Card, Badge, StatusChip): `src/components/ui/`
- Environment switching (dev/prod): `src/services/config.ts`

---

### Phase 1: Authentication & User Session — DONE

**Goal:** Users can log in, stay logged in across app restarts, and be logged out when sessions expire.

**Business Requirements:**
- Keycloak SSO login using in-app browser or WebView (not system browser redirect) with PKCE code challenge
- Support for Microsoft federation (the company uses Microsoft accounts via Keycloak)
- Direct username/password login with TOTP/2FA support as a fallback
- Secure token storage that persists across app restarts (access token, refresh token, ID token)
- Automatic token refresh before expiry (proactive, 30 seconds before expiration)
- Session expiration handling: when refresh fails, log the user out with a clear message
- Retry logic for authentication requests: exponential backoff for network failures, DNS fallback
- Server-side logout (revoke session on Keycloak, not just local token deletion)
- Employee validation: after login, validate the user against the backend (`/api/mobile/auth/validate`) to get their employee record and permissions
- App version check on startup: the backend reports minimum required version and optional update version. Block the app if a forced update is needed, show a prompt for optional updates. Support maintenance mode (block access with a message)

**Refer to:** `lib/auth_service.dart`, `lib/login_page.dart`, `lib/app/auth_wrapper.dart`

**Deliverable:** Users can log in, the app remembers their session, tokens refresh silently, and version/maintenance checks work.

---

### Phase 2: Permissions & Role-Based Access — DONE

**Goal:** The app shows or hides features based on what the user is allowed to do.

**Business Requirements:**
- Extract permissions and roles from the JWT token (both realm roles and client-specific roles)
- The permission system controls:
  - Which modules are visible (Finance, Gallery, or both)
  - Within Finance, which tabs appear (Transactions, Reconciliation)
  - Within each feature, what actions are allowed (create, read own, read all, update)
  - Special permissions like selecting a partner in transactions or adding receipts to submitted transactions
- Cache permissions in memory; clear on logout
- The main navigation should only show modules/tabs the user has permission to access
- If a user has zero permitted modules, show an appropriate empty state

**Refer to:** `lib/features/permissions/permission_service.dart`

**Deliverable:** The app dynamically shows/hides UI based on user permissions.

---

### Phase 3: Transactions — DONE

**Goal:** Users can create financial transactions, attach receipts, and browse transaction history.

**Business Requirements:**

**Transaction Creation Form — DONE:**
- Multi-section form with: statement (description), amount, currency (default SAR), tax toggle, date, partner (employee or wallet), other party, bank fees, project code, client, notes
- Receipt attachments: up to 4 images/documents per transaction, with inline preview and remove capability
- Autocomplete/search fields for: projects, clients, employees, other parties, tags — each fetched from the backend with search-as-you-type
- Form caches the last selected client and project for convenience
- Validation: required fields enforced with inline error messages before submission (partner and other party required)
- Submission confirmation dialog showing a preview of all entered data
- Success feedback: play a sound on successful submission via `soundService.ts` + `expo-av`
- Multipart upload of receipts during submission
- Partner search in transaction history uses SelectField dropdown with employee ID-based filtering

**Transaction History — DONE:**
- Paginated list of transactions (20 per page) with infinite scroll and pull-to-refresh
- Search by: statement text, transaction number, partner employee, other party, client, project, amount range (min/max with +/- sign toggle), date range, tax quarter/year
- Filter by approval status (Pending, Approved, Rejected)
- Toggle between "my transactions" and "all transactions" (permission-dependent)
- Each transaction card shows: statement, amount with color coding, status chip, client, project, partner, date, receipt indicator
- Tapping opens a detail bottom sheet with all fields, transaction flow visualization, receipt thumbnails, and notes
- Skeleton shimmer loading, empty state with animation, error state with retry
- Reusable components created: SegmentedControl, SkeletonCard, EmptyState, ErrorState, DatePickerField (with clear), SelectField (with Android modal picker)
- Security: input sanitization (trim, length cap, regex escaping), error code mapping (never raw API errors), hardcoded PAGE_SIZE, defensive own/all toggle
- Backend enhancements: regex escaping on all `contains` queries, limit capped at 100, page clamped to ≥1

**Approval Workflow — DONE:**
- Users with update permission can approve or reject transactions
- Approval status chips (visual indicators)
- Approve/Reject/Set to Pending action buttons on transaction details with confirmation dialogs
- No optimistic updates — waits for server confirmation, then refreshes the full transaction in-place

**Adding Receipts to Submitted Transactions — DONE:**
- Special permission-gated feature with two modes: add-only (partner employee) and full-edit (accountant)
- Add-only: user must have `add_receipts_2_submitted_transaction` permission AND be the partner employee on the transaction
- Full-edit: user must have `transactions_update` permission — can add and remove receipts
- Receipt upload via `POST /api/mobile/receipts/upload`, then link via `POST /transactions/add-receipts` (add-only) or `PUT /transactions` (full-edit)
- ReceiptEditorScreen with EditableReceiptGrid (tap-to-delete toggle), ReceiptUploadProgress (per-file status)
- Security reviewed: 11 findings addressed (permission bypass, receipt ID injection, MIME validation)
- 63 new tests covering service, permissions, editor hook, and wiring

**Share Intent Integration — DONE:**
- When a user shares a file (image/document) from another app to this app, the file is available to attach as a receipt in the transaction form
- If the user is not logged in when the share happens, a banner on the login screen indicates pending files, and attaches them after login
- Flow selector bottom sheet: user chooses where to route shared files (Transaction, Reconciliation, Gallery) — extensible registry pattern, Reconciliation/Gallery show "Coming soon"
- Module-level pub/sub store (`shareIntentStore`) with 4-state machine: idle → files_received → flow_selected → idle
- `expo-share-intent` package handles native Android intent filters (image/*, application/pdf) and iOS Share Extension
- `ShareIntentBridge` component bridges library hook to store in root layout
- Validation at trust boundary: MIME type, file size (10MB), filename sanitization, file count limits
- `sharedFilesAdapter` converts shared files to receipt attachments with MAX_ATTACHMENTS cap
- Security reviewed: 12 findings addressed (path traversal, MIME spoofing, file size bombs)
- 91 tests covering store, service, validation, flow targets, hook, and form integration

**Refer to:** `lib/features/transactions/` (all files), `lib/widgets/` (form widgets, receipt widgets)

**Deliverable:** Full transaction creation, history browsing, approval workflow, and share intent receipt attachment.

---

### Phase 4: Reconciliation — DONE

**Goal:** Users can create financial reconciliation records and browse reconciliation history.

**Business Requirements:**

**Reconciliation Creation Form — DONE:**
- Multi-step form (5 steps) with page-by-page navigation and a progress indicator:
  1. Basic info: statement, total amount, date, currency, bank fees (required, with separate currency selector)
  2. Type selection: salary, bonus, or normal
  3. Sender details: entity type (wallet/employee/bilad card), finance channel (required), employee selection (searchable autocomplete, if employee type)
  4. Receiver details: entity type (wallet/employee/bilad card), finance channel (required), employee selection (searchable autocomplete, if employee type)
  5. Additional info: notes, summary card with ReconciliationFlowWidget and DetailRow
- Validation per step: cannot advance to the next step until current step is valid
- Finance channels are fetched from the backend and cached for 24 hours
- Employee selection uses searchable AutocompleteField with cached employee list (minChars=0, shows all on focus)
- 10-second countdown preview dialog with pause/resume, animated entrance, flow widget
- Success sound feedback on submission
- Permission-gated FAB on reconciliation tab (canCreateReconciliation)
- Shared constants promoted: CURRENCIES, NOTES_MAX_LENGTH, validators moved to @/types/shared.ts and @/utils/sanitize.ts
- Security: input sanitization (sanitizeText, isValidObjectId, isValidEntityType, isValidReconciliationType), error code mapping (never raw API errors)
- 66 new tests (44 validation + 22 service), all passing

**Reconciliation History — DONE:**
- Paginated list of reconciliation records (20 per page) with pull-to-refresh
- Toggle between "my reconciliations" and "all reconciliations" (permission-dependent)
- Search by: statement, reconciliation number, amount range (min/max, always positive — no sign toggle), date range, sender/receiver entity type (wallet/employee/bilad card), sender/receiver employee (autocomplete dropdown with ObjectId-based filtering), sender/receiver channel, reconciliation type (salary/bonus/normal)
- Filter by approval status (Pending, Approved, Rejected)
- Employee autocomplete shows all cached employees on focus (`minChars=0`), sends ObjectId for precise matching
- Conditional employee fields: only visible when the corresponding entity type is set to "employee"
- Each card shows: statement, amount, status chip, sender/receiver flow, date
- Detail bottom sheet with all fields, reconciliation flow visualization, and notes
- Approval workflow: approve/reject/return to pending with confirmation dialogs
- Shared components reused: PaginatedList, DetailRow, ApprovalStatusChips, AmountInput (extracted as shared `src/components/finance/AmountInput.tsx`)
- Security: input sanitization (ObjectId validation for employee IDs, entity type allowlist, regex escaping), cross-validation (employee filter cleared when entity type is not "employee"), backend ownership filter enforced as mandatory AND for `read_own` users
- Backend enhancements: `fromType`/`toType`/`fromEmployee`/`toEmployee` query params, `amountMin`/`amountMax` range query

**Approval Workflow — DONE:**
- Users with reconciliation update permission can approve or reject records
- Approval status chips (visual indicators)
- Approve/Reject/Set to Pending action buttons on detail sheet with confirmation dialogs
- No optimistic updates — waits for server confirmation, then refreshes in-place

**Share Intent Integration — DONE:**
- Enabled the "Reconciliation" flow target in `src/services/shareIntent/flowTargets.ts` (was disabled with "Coming soon" badge)
- When user shares files and selects Reconciliation, navigates to the reconciliation form with files pre-attached
- Follows the same pattern as transactions: consume files via `useShareIntent()` hook + shared adapter on form mount
- Extracted `convertSharedFilesToAttachments()` to shared `src/utils/sharedFilesAdapter.ts` (reusable across features)
- ReceiptPickerSection added to Step 4 (Additional Info) for camera/gallery/document attachments
- Auto-opens reconciliation form and switches tab when share intent targets reconciliation
- Security: explicit `allowedMimeTypes` on flow target (was `null`), MIME validation at trust boundary
- Note: file attachments are collected in the UI but not yet sent to backend (backend multipart support pending)

**Refer to:** `lib/features/reconciliation/`

**Deliverable:** Full reconciliation form with step-by-step flow, history browsing, and share intent attachment.

---

### Phase 5: Gallery — Albums & Media Viewing

**Goal:** Users can browse photo/video albums, view media full-screen, and download media.

#### Test Data Seeding

Each sub-phase requires realistic gallery data for testing. Provide two scripts (run via `pnpm seed:gallery` and `pnpm seed:gallery:clean`) that seed and clean the following directly in MongoDB:

- **Tags:** 5–10 tags (e.g. "site-visit", "warehouse", "office", "event", "marketing")
- **Albums:** 8–10 albums with varying states — some with project associations, some with tags, some empty, some with 50+ items (for pagination testing)
- **Media items:** Mix of images and videos across albums. Use placeholder/sample files uploaded to the backend (or reference existing media IDs). Include items with and without watermarked variants
- **Projects:** Ensure 2–3 projects exist for album-project association testing

Scripts should be idempotent (safe to re-run). Clean script removes only seeded data (identified by a `_seeded: true` flag or a known prefix like `[TEST]` in names).

Update seed data as sub-phases progress:
- **5A:** Albums, tags, projects
- **5B:** Media items inside albums (images + videos, varying counts)
- **5C:** Albums with enough items to test multi-select and reassignment
- **5D:** Media items with and without watermarked variants for download format selection

---

#### Phase 5A: Album Browsing & CRUD — DONE

**Goal:** Users can browse, create, and rename albums.

**Completed:**
- 2-column album grid with mosaic thumbnails (0-4 images), item count, default star badge
- Album creation via bottom sheet (name input, locale-aware, copies to both languages)
- Album rename via long-press → options sheet → edit name dialog (blocked on default album)
- Shared gallery components: MediaThumbnail (auth-aware), AlbumMosaic (mosaic layout)
- Gallery service: fetchAlbums (limit 100, sort default first), createAlbum, updateAlbumTitle
- useAlbumList hook (debounced search, pull-to-refresh, optimistic updates)
- useAlbumActions hook (create + rename with validation)
- Locale-aware title display via getLocalizedTitle()
- Gallery permissions fixed to match Flutter: gallery_cms_read/create/update/delete + cms_admin/editor/viewer fallbacks
- Module switcher icons (Wallet for Finance, Image for Gallery)
- Skeleton loading, empty state, error state with retry, search empty state
- Input sanitization: album name validation, search regex stripping, ObjectId validation
- Seed script: `pnpm seed:gallery` / `pnpm seed:gallery:clean` (8 tags, 6 albums, 20 items)
- i18n: 20 gallery keys in en + ar
- 56 gallery tests + 1 permission test, all passing (1039 total)

**Deferred (not in Flutter, no backend support):**
- Album deletion (no backend endpoint, Flutter doesn't expose it from album grid)
- Tag management (tags are per-item, assigned during upload in Phase 6)
- Project association on albums (per-item, Phase 6)

**Refer to:** `lib/features/gallery/pages/gallery_page.dart`, `lib/features/gallery/services/gallery_api_service.dart`

---

#### Phase 5B: Media Viewing — DONE

**Goal:** Users can view media inside albums with full-screen viewer.

**Completed:**
- Media grid inside album detail showing authenticated thumbnails (images and videos distinguished with play icon overlay)
- Tap to open full-screen media viewer with pinch-to-zoom (ZoomableImage via react-native-gesture-handler)
- Video playback support in the viewer (VideoPlayer via expo-video with `?token=` query param + Authorization header belt-and-suspenders auth, since native players don't reliably forward custom HTTP headers)
- Paginated media loading for large albums (20 per page, infinite scroll)
- MediaThumbnail component with shimmer loading, auth header gating (prevents 401 race), error/placeholder states
- useAuthHeaders hook with 30s auto-refresh and stable object reference (no unnecessary re-renders)
- Gallery service: fetchAlbumMedia with pagination
- useAlbumMedia hook with loadMore, refresh, loading states
- Full-screen viewer with horizontal swipe navigation, RTL-aware, counter overlay
- Media URL utilities: normalizeMediaUrl (no domain allowlist), getFullResMediaUrl
- Seed script updated: correct MongoDB collection name (galleries), real file references
- 4 MediaThumbnail auth race regression tests, useAuthHeaders tests, mediaUrls tests
- i18n: media viewing keys in en + ar

**Refer to:** `lib/features/gallery/pages/album_detail_page.dart`, `lib/features/gallery/pages/media_viewer_page.dart`

**Deliverable:** Users can browse media in albums and view them full-screen.

---

#### Phase 5C: Multi-Select & Bulk Actions — DONE

**Goal:** Users can select multiple media items and perform bulk operations.

**Completed:**
- Long-press to enter selection mode, tap to toggle selection
- Select all / deselect all with selection header showing count
- Bulk delete with confirmation dialog (permission-gated: `gallery_cms_delete`)
- Bulk manage sheet: unified tri-state UI for album assignment, tag assignment, and project association
- Selection action bar with permission-gated buttons (delete, manage)
- Exit selection mode on action completion or explicit cancel
- `useMediaSelection` hook (Set-based, O(1) lookups)
- `useMediaBulkActions` hook (sequential processing, progress tracking)
- Gallery service: `deleteMediaItem`, `fetchMediaItemDetail`, `manageMediaItem`
- `validateBulkIds` utility (ObjectId validation, dedup, max 50 cap)
- Backend: `PUT /gallery/[id]/manage` endpoint for full item management
- Backend: `afterDelete` hook cleans up album references on delete
- Backend: permission checks added to PATCH and POST `/albums` endpoints
- Backend: `GET /gallery/[id]` augmented with album memberships
- Fix: FAB hidden when inside album detail
- Fix: RTL-aware back arrow using `i18n.dir()`
- i18n: 23 new keys in en + ar
- 49 new tests (1142 total, all passing)

**Refer to:** `lib/features/gallery/pages/album_detail_page.dart`

**Deliverable:** Multi-select with bulk delete and media reassignment.

---

#### Phase 5D: Download System — DONE

**Goal:** Users can download media to their device with queue management.

**Completed:**
- Download individual items from full-screen viewer or bulk download selected items (integrates with 5C multi-select)
- Format selection via DownloadFormatSheet: original quality or watermarked version, with smart detection of mixed selections and graceful fallback when watermarked variant unavailable
- Downloads save to device gallery/photos via `expo-media-library` (MediaLibrary.createAssetAsync), with cache fallback if permission denied
- Download progress shown via Android system notifications (sticky progress, replaced atomically with result on completion) and in-app DownloadProgressBar (completed/total count, progress bar, failure badge)
- Download queue with max 2 concurrent downloads (DownloadQueue class), FIFO ordering, automatic next-job processing
- Success sound playback on download completion
- Counter resets on new download batch, progress bar clears when leaving album
- Input validation: ObjectId regex, filename sanitization, item deduplication
- i18n: all download strings in en + ar
- Comprehensive test coverage: downloadQueue, downloadService, downloadNotificationService, useDownload tests

**Not implemented (not in Flutter either):**
- Download resume/retry persistence across app restarts (queue is in-memory only)

**Refer to:** `lib/features/gallery/services/gallery_download_service.dart`, `lib/core/downloads/`

**Deliverable:** Full download system with queue, progress, and system integration.

---

### Phase 6: Gallery — Upload & Processing

**Goal:** Users can upload photos and videos with optimization and optional watermarking.

---

#### Phase 6A: Upload Screen & Media Selection

**Goal:** The upload tab has a working screen where users can pick media and select metadata.

**Business Requirements:**

**Upload Screen UI:**
- Replace current upload tab placeholder with the upload screen
- Two picker cards: "Pick Images" (up to 20) and "Pick Video" (1 only) via `expo-image-picker`
- Image preview grid (3 columns) with tap-to-remove
- Video preview card with thumbnail
- Upload button enabled only when media selected + required metadata set

**Metadata Selection:**
- Album picker (multi-select, required) with search and inline creation via bottom sheet
- Tag picker (multi-select, required) with search and inline creation via bottom sheet
- Project picker (single-select, optional) with search and inline creation via bottom sheet
- Validation: upload blocked until albums and tags are selected

**Gallery Service Extensions:**
- `fetchTags()` — list tags with search/locale support
- `createTag(name, locale)` — inline tag creation
- `createProject(name, clientName?, clientId?)` — inline project creation

**Types & Constants:**
- `ItemState` enum (waiting, hashing, checkingDuplicate, optimizing, checkingSize, watermarking, uploading, done, skipped, failed, sizeExceeded)
- `PipelineStatus`, `PipelineItemStatus`, `PipelineResult` types
- `WatermarkDraft` type (xPct, yPct, widthPct, opacityPct, noWatermarkNeeded)
- Upload constants: MAX_IMAGES (20), MAX_VIDEO (1), MAX_FILE_SIZE (100MB), MAX_CONCURRENT_UPLOADS (3), MAX_UPLOAD_RETRIES (2)

**Refer to:** `lib/features/gallery/pages/gallery_upload_page.dart` (media selection + metadata UI)

**Deliverable:** User can pick media, select albums/tags/project, but cannot upload yet.

---

#### Phase 6B: Upload Pipeline & Image Optimization

**Goal:** Images can be optimized, deduplicated, and uploaded to the backend.

**Business Requirements:**

**Image Optimization:**
- Resize to max 2048px on longest edge
- Compress to ~65% quality
- Convert JPEG/HEIC to WebP, keep PNG as PNG
- Skip optimization if compressed file is larger than original
- Use `expo-image-manipulator` for resize/compress/format conversion

**File Hashing & Duplicate Detection:**
- Compute SHA-256 hash of each file before upload (use `expo-crypto` or streaming approach to avoid blocking JS thread)
- Call `GET /api/mobile/gallery/check-hash?hash=...` to check for duplicates
- If duplicate found, show `DuplicateSheet` bottom sheet with existing item details (filename, albums, tags, project, date)
- User can choose "Add to Albums" (links existing item to selected albums via `POST /api/mobile/gallery/{id}/albums`) or "Skip"
- "Apply to All Remaining" checkbox caches the decision for subsequent duplicates

**Upload Pipeline:**
- `UploadPipeline` orchestrator with weighted progress tracking
  - Image weight: 1.0 each (0.20 optimize + 0.10 watermark + 0.75 upload)
  - Video weight: 3.0 (1.8 optimize + 1.2 watermark+upload)
  - Progress = completedWeight / totalWeight
- Max 3 concurrent image uploads (FIFO)
- 2 retry attempts per failed upload with exponential backoff (500ms, 1000ms)
- Max file size check: 100 MB per item
- Pipeline stages per item: hash → dedup check → optimize → size check → (watermark placeholder) → upload
- Multipart upload via `POST /api/mobile/gallery` with fields: file, albumIds, tags, project, originalSourceHash, noWatermarkNeeded, watermarkOverrides

**Upload Progress UI:**
- `UploadProgressCard` showing overall progress bar with percentage
- Per-item status with icons (waiting, hashing, optimizing, uploading, done, skipped, failed, sizeExceeded)
- Error message display for failed items
- Upload stages: idle → processing → done/error
- Success sound on completion
- Flow reset: clear selections and return to idle state after completion

**Result Tracking:**
- `PipelineResult` with successCount, failedCount, skippedCount, oversizedCount, bytesSaved
- Summary shown to user after pipeline completes

**Refer to:** `lib/features/gallery/services/upload_pipeline.dart`, `lib/features/gallery/services/image_optimization_service.dart`, `lib/features/gallery/services/file_hash_service.dart`, `lib/features/gallery/widgets/duplicate_sheet.dart`, `lib/features/gallery/widgets/upload_progress_card.dart`

**Deliverable:** Full image upload pipeline working end-to-end with optimization, deduplication, progress tracking, and retry.

---

#### Phase 6C: Watermark System

**Goal:** Users can position a watermark on media before upload.

**Business Requirements:**

**Watermark Editor Screen:**
- Full-screen modal opened after metadata selection, before pipeline runs
- Dark-themed AppBar with close (cancel), title, and "Apply to All" button
- Main canvas showing current media item preview with interactive watermark overlay
- Watermark overlay is draggable (reposition) and resizable (corner/edge handles)
- Maintains logo aspect ratio during resize (fallback: 2.5)
- "No Watermark" toggle per item (FilterChip, red when active, disables sliders)
- Opacity slider (10–100%, 90 divisions) with percentage label
- "Reset Defaults" button restores default settings for current item
- Thumbnail strip at bottom: horizontal scroll of all media items, tap to switch, active item highlighted
- Confirm button returns `Map<string, WatermarkDraft>` keyed by item ID, cancel returns null
- "Apply to All" copies position/size/opacity from active item to all others

**Watermark Application:**
- Apply logo overlay to images using Skia canvas rendering (via `@shopify/react-native-skia`) or equivalent
- Logo: green branded logo (`assets/logo-green.png`)
- Position/size/opacity from `WatermarkDraft` (all percentage-based, 0–100)
- Save watermarked image to temp file
- Falls back to original if watermarking fails
- Video watermarking deferred to server-side (per Expo limitations)

**Settings & Defaults:**
- Fetch default watermark settings from `GET /api/mobile/gallery/watermark-settings` (logo URL, x, y, width, opacity)
- Persist last-used watermark settings in AsyncStorage across sessions
- Send `watermarkOverrides` (x, y, width, opacity) with upload for server-side record

**Pipeline Integration:**
- Watermark stage runs between optimization and upload in the pipeline
- If `noWatermarkNeeded` is set for an item, skip watermark application
- Watermark weight: 0.10 of image weight (already allocated in 6B progress weights)

**Refer to:** `lib/features/gallery/pages/watermark_editor_screen.dart`, `lib/features/gallery/widgets/watermark_editor_canvas.dart`, `lib/features/gallery/services/watermark_applicator.dart`, `lib/features/gallery/services/watermark_settings_repository.dart`

**Deliverable:** Watermark editor with interactive positioning, image watermarking, and pipeline integration.

---

#### Phase 6D: Video Processing & Share Intent

**Goal:** Video optimization support and Gallery share intent flow target.

**Business Requirements:**

**Video Optimization:**
- Compress video using H.264 encoding (via `react-native-compressor` or similar)
- Show compression progress (0–100%) in the pipeline UI
- Fall back to original if compression fails or produces a larger file
- Video thumbnail generation at selection time for preview
- Video processed sequentially in pipeline (not concurrent with other videos)
- Video weight: 3.0 in pipeline progress (1.8 optimize + 1.2 watermark+upload)

**Share Intent Integration:**
- Enable the "Gallery" flow target in `src/services/shareIntent/flowTargets.ts` (currently disabled with "Coming soon" badge)
- When user shares files from another app and selects Gallery, navigate to upload screen with files pre-attached
- Follow the same pattern as Transactions and Reconciliation: consume files via `useShareIntent()` hook + shared adapter on form mount
- Shared files skip the device gallery/camera picker step and go directly into the upload pipeline
- Validate shared files against gallery constraints (allowed MIME types: image/*, video/*, max file size 100MB)
- Auto-open the upload screen and switch to Gallery module when share intent targets Gallery
- Security: explicit `allowedMimeTypes` on flow target, MIME validation at trust boundary

**Seed Data Updates:**
- Update seed script with media items that have varying watermark states for testing

**Refer to:** `lib/features/gallery/services/video_optimization_service.dart`, `lib/features/gallery/services/video_processing_service.dart`

**Deliverable:** Videos can be compressed and uploaded. Shared files route to Gallery upload flow.

---

**Phase 6 Dependency Chain:**
```
6A → 6B → 6C
              ↘
               6D (6C and 6D can be parallel after 6B)
```

---

### Phase 7: Shared Components & Polish

**Goal:** Ensure all cross-cutting concerns are solid.

**Already completed during earlier phases:**
- Employee cache: 24-hour cache-first with background refresh and expired-cache fallback (`src/services/employeeCacheService.ts`, Phase 3)
- Finance channel cache: 24-hour stale-while-revalidate (`src/services/financeChannelService.ts`, Phase 4)
- Sound feedback on successful form submissions: transactions, reconciliation, gallery downloads (`src/services/soundService.ts`)
- Consistent loading states, error states, and empty states: SkeletonCard, EmptyState, ErrorState used across all features (`src/components/ui/`)
- Pull-to-refresh: RefreshControl in transaction list, reconciliation list, album grid, and media grid
- Module switcher bottom sheet: Finance/Gallery toggle (`src/components/layout/ModuleSwitcherSheet.tsx`, Phase 0)

**Remaining:**
- Profile avatar: currently shows User icon fallback — add initials fallback (first letter of name)
- Deep linking support for feature-specific routes (if needed for future features)

**Refer to:** `lib/widgets/`, `lib/core/services/sound_service.dart`

**Deliverable:** All shared UI and services polished and consistent.

---

## Phase Summary

| Phase | Name | Depends On |
|-------|------|------------|
| 0 | Project Scaffolding & Infrastructure | — |
| 1 | Authentication & User Session | Phase 0 |
| 2 | Permissions & Role-Based Access | Phase 1 |
| 3 | Transactions | Phase 2 |
| 4 | Reconciliation | Phase 2 |
| 5A | Gallery — Album Browsing & CRUD | Phase 2 |
| 5B | Gallery — Media Viewing | Phase 5A |
| 5C | Gallery — Multi-Select & Bulk Actions | Phase 5B |
| 5D | Gallery — Download System | Phase 5B |
| 6A | Gallery — Upload Screen & Media Selection | Phase 5A |
| 6B | Gallery — Upload Pipeline & Image Optimization | Phase 6A |
| 6C | Gallery — Watermark System | Phase 6B |
| 6D | Gallery — Video Processing & Share Intent | Phase 6B |
| 7 | Shared Components & Polish | All phases |

Phases 3, 4, and 5A can be worked on in parallel once Phase 2 is complete. 5C and 5D can be worked on in parallel once 5B is complete. 6C and 6D can be worked on in parallel once 6B is complete.

---

## Notes for the Implementing AI

1. **Always refer to the Flutter source** at `finance_mobile/lib/` for exact API contracts, request/response shapes, validation rules, error handling, and edge cases. This document describes *what* the app does, not *how* — the Flutter code is the source of truth for the *how*.

2. **API base URL** is configurable: dev is `http://192.168.100.53:3000`, production is `https://ruqaqa.sa`. All mobile API routes are under `/api/mobile/`.

3. **Video watermarking** should be moved to server-side processing. Do not attempt client-side video watermarking in React Native — the ecosystem does not have a reliable solution.

4. **Use `expo prebuild`** and development builds from day one. Do not rely on Expo Go — too many features require native modules.

5. **JWT size**: Keycloak tokens may exceed expo-secure-store's 2048-byte limit. Plan for this in Phase 1.

6. **File hashing for duplicate detection** in Phase 7 needs careful handling — do not block the JS thread with large file hash computation. Use a native module or streaming approach.
