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

#### Phase 5B: Media Viewing

**Goal:** Users can view media inside albums with full-screen viewer.

**Business Requirements:**
- Media grid inside album showing thumbnails (images and videos distinguished visually)
- Tap to open full-screen media viewer with pinch-to-zoom for images
- Video playback support in the viewer
- Pagination for large albums

**Refer to:** `lib/features/gallery/pages/album_detail_page.dart`, `lib/features/gallery/pages/media_viewer_page.dart`

**Deliverable:** Users can browse media in albums and view them full-screen.

---

#### Phase 5C: Multi-Select & Bulk Actions

**Goal:** Users can select multiple media items and perform bulk operations.

**Business Requirements:**
- Long-press to enter selection mode, tap to toggle selection
- Select all / deselect all
- Bulk delete with confirmation dialog
- Reassign media: move/copy selected items to a different album, reassign tags, or change project association
- Exit selection mode on action completion or explicit cancel

**Refer to:** `lib/features/gallery/pages/album_detail_page.dart`

**Deliverable:** Multi-select with bulk delete and media reassignment.

---

#### Phase 5D: Download System

**Goal:** Users can download media to their device with queue management.

**Business Requirements:**
- Download individual items or selected items (integrates with 5C multi-select)
- Format selection: original quality or watermarked version (if watermarked variant exists on the server)
- Downloads save to the device's public Downloads folder (Android) or Documents (iOS)
- Downloaded media should appear in the system gallery/photos app (Android media scanner integration)
- Download progress shown via system notifications
- Support for resuming interrupted downloads
- Download queue: max 2 concurrent downloads, remaining queued

**Refer to:** `lib/features/gallery/services/gallery_download_service.dart`, `lib/core/downloads/`

**Deliverable:** Full download system with queue, progress, and system integration.

---

### Phase 6: Gallery — Upload & Processing

**Goal:** Users can upload photos and videos with optimization and optional watermarking.

**Business Requirements:**

**Media Selection & Upload:**
- Pick multiple images (up to 20) and/or 1 video per upload batch from the device gallery or camera
- Upload progress tracking per item and overall batch progress
- Upload pipeline stages shown to the user:
  1. Computing file hashes (for duplicate detection)
  2. Checking for duplicates against server
  3. Optimizing images (compression, format conversion)
  4. Compressing videos (if applicable)
  5. Applying watermark (if enabled)
  6. Uploading to server
  7. Assigning to album/tags
- Duplicate detection: if a file hash matches an existing server file, prompt the user — they can choose to add it to the album anyway or skip it. "Apply to all" option for batch decisions
- Concurrent uploads: max 3 at a time
- Retry: 2 attempts per failed upload item
- Max file size: 100 MB per item

**Image Optimization:**
- Resize to max 2048px on longest edge
- Compress to ~65% quality
- Convert JPEG/HEIC to WebP, keep PNG as PNG
- Skip optimization if compressed file is larger than original

**Video Optimization:**
- Compress using H.264 encoding
- Show compression progress
- Fall back to original if compression fails or produces a larger file

**Watermark System:**
- Interactive watermark editor: users can position a logo watermark on a canvas preview
- Adjustable: position (X%, Y%), size (width %), opacity (0-100%)
- Watermark settings persist across sessions
- Applied to images before upload (video watermarking can be deferred to server-side — see Expo limitations above)

**Album & Tag Assignment:**
- After upload, assign media to an album
- Create new albums or tags inline during the upload flow
- Associate albums with projects

**Refer to:** `lib/features/gallery/services/upload_pipeline.dart`, `lib/features/gallery/services/image_optimization_service.dart`, `lib/features/gallery/services/video_optimization_service.dart`, `lib/features/gallery/services/watermark_applicator.dart`, `lib/features/gallery/pages/gallery_upload_page.dart`, `lib/features/gallery/pages/watermark_editor_screen.dart`

**Deliverable:** Full media upload pipeline with optimization, watermarking, and duplicate detection.

---

### Phase 7: Shared Components & Polish

**Goal:** Ensure all cross-cutting concerns are solid.

**Business Requirements:**
- Profile avatar display (employee photos from the backend, with fallback initials)
- Employee cache: fetch and cache the full employee list for 24 hours. Use cache-first strategy (show cached data immediately, refresh in background). Fall back to expired cache on network failure
- Finance channel cache: same 24-hour cache strategy as employees
- Sound feedback on successful form submissions
- Consistent loading states, error states, and empty states across all features
- Pull-to-refresh where applicable
- Module switcher bottom sheet (Finance / Gallery toggle)
- Deep linking support if needed for future features

**Refer to:** `lib/widgets/`, `lib/features/transactions/services/employee_cache_service.dart`, `lib/features/reconciliation/services/channel_service.dart`, `lib/core/services/sound_service.dart`

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
| 6 | Gallery — Upload & Processing | Phase 5A |
| 7 | Shared Components & Polish | All phases |

Phases 3, 4, and 5A can be worked on in parallel once Phase 2 is complete. 5C and 5D can be worked on in parallel once 5B is complete.

---

## Notes for the Implementing AI

1. **Always refer to the Flutter source** at `finance_mobile/lib/` for exact API contracts, request/response shapes, validation rules, error handling, and edge cases. This document describes *what* the app does, not *how* — the Flutter code is the source of truth for the *how*.

2. **API base URL** is configurable: dev is `http://192.168.100.53:3000`, production is `https://ruqaqa.sa`. All mobile API routes are under `/api/mobile/`.

3. **Video watermarking** should be moved to server-side processing. Do not attempt client-side video watermarking in React Native — the ecosystem does not have a reliable solution.

4. **Use `expo prebuild`** and development builds from day one. Do not rely on Expo Go — too many features require native modules.

5. **JWT size**: Keycloak tokens may exceed expo-secure-store's 2048-byte limit. Plan for this in Phase 1.

6. **File hashing for duplicate detection** in Phase 7 needs careful handling — do not block the JS thread with large file hash computation. Use a native module or streaming approach.
