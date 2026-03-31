# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

Expo (React Native + TypeScript) mobile app for Ruqaqa employees. It's a migration from the Flutter app at `../finance_mobile/lib/` — that codebase is the source of truth for business logic, API contracts, validation rules, and edge cases.

App ID: `sa.ruqaqa.finance` | Version: 1.2.1 | Scheme: `ruqaqa://`

## Commands

```bash
pnpm start              # Metro dev server (port 5173)
pnpm start --clear      # Metro with cache clear
pnpm android:build      # Build + install native APK on connected device
pnpm ios:build          # Build + install on iOS device/sim
pnpm android            # Start Metro for Android
pnpm ios                # Start Metro for iOS
pnpm test               # Jest unit tests (224 tests, 15 suites)
pnpm test:e2e           # Clear app data, forward port, run all Maestro E2E tests
pnpm test:e2e:flow      # Run a specific Maestro flow file
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

### Transaction History (Phase 3 — Operations tab)

Feature-driven structure under `src/features/transactions/`:
- `types.ts` — `Transaction`, `TransactionFilters`, `ApprovalStatus`, `TaxQuarter`, `TaxYear` types + constants (`PAGE_SIZE=20`, `EMPTY_FILTERS`)
- `services/transactionService.ts` — `fetchTransactions()`, `fetchTransactionById()`, `updateApprovalStatus()` + `TransactionError` class with error code mapping
- `utils/sanitize.ts` — Input sanitization: `sanitizeText()` (trim + 200 char cap), `sanitizeFilters()`, `hasActiveFilters()`, enum validators
- `utils/formatters.ts` — Date, amount, partner display formatting
- `hooks/useTransactionList.ts` — Pagination, filters, own/all toggle, refresh, in-place updates
- `hooks/useApprovalAction.ts` — Approval status change with loading state (no optimistic updates)
- `components/` — TransactionHistoryScreen (orchestrator), FilterBar, TransactionCard, TransactionList, SearchModal, TransactionDetailSheet, ApprovalActions, ApprovalStatusChips, TransactionFlowWidget, ReceiptThumbnails

**Search fields:** statement, transaction number, partner employee, other party, client, project, amount range (min/max with +/- sign toggle), tax quarter/year, approval status, date range

**Security patterns:** All filter inputs sanitized before API calls. Error codes mapped to i18n strings (never raw API messages). `PAGE_SIZE` hardcoded. Defensive own/all toggle. Backend: regex escaping on all `contains` queries, limit capped at 100, page clamped ≥1.

### Services

| Service | Role |
|---------|------|
| `authService.ts` | Keycloak token exchange (PKCE), refresh, server logout with retry. Uses `withRetry()` from `utils/retry.ts` |
| `authContext.ts` | React context: session state, login/logout, AppState listener for foreground refresh. Uses `deduplicatedRefresh` to prevent timer/foreground race |
| `apiClient.ts` | Axios: auto Bearer, proactive refresh, 401 retry with dedup, `uploadMultipart()` helper |
| `employeeService.ts` | Validates employee via `apiClient` post-login |
| `tokenStorage.ts` | `expo-secure-store` wrapper with chunking for large JWTs (1800-byte chunks), crash-safe write order (chunks first, count last) |
| `permissionService.ts` | Extracts 15 permission flags from JWT roles using `keycloakConfig.clientId`. `getAvailableModules()`, `getAvailableFinanceTabs()` |
| `versionCheckService.ts` | `/api/mobile/version-check` → forced update, optional update, maintenance mode. Download URL validated against trusted domains |
| `appLifecycle.ts` | First-launch tracking via AsyncStorage |
| `config.ts` | Dev/prod URLs keyed on `releaseChannel` from `app.json` |
| `transactionService.ts` | Transaction CRUD: list (paginated + filters), get by ID, update approval status. Throws typed `TransactionError` |

### Utilities

| Utility | Role |
|---------|------|
| `utils/retry.ts` | `withRetry()` exponential backoff + `isRetryableError()` (network/5xx) |
| `utils/deduplicatedRefresh.ts` | `createDeduplicatedRefresh()` — concurrent calls share one promise |
| `utils/colorUtils.ts` | `withAlpha(color, alpha)` — safe hex alpha application. Use this instead of `+ '1A'` concatenation |

### Theme & design system

`ThemeProvider` exposes `useTheme()` → `{ colors, typography, spacing, radius, shadows }`. Supports light/dark mode. Design derived from ruqaqa-website, documented in `docs/design-system.md`.

- Use theme tokens in styles, not raw values
- Use `start/end` instead of `left/right` for RTL support
- Use `withAlpha()` for transparent colors, not hex string concatenation
- Use `colors.onPrimary`/`colors.onSecondary`/`colors.onError` for text on colored backgrounds
- Accent Green (`#208f5a`) should appear as a supporting accent across all screens (not just login) to connect with the green logo

### i18n

`i18next` + `react-i18next`. Arabic and English with runtime switching. RTL applied via `I18nManager.forceRTL()`. Keys are camelCase: `t('signInWithMicrosoft')`. Strings in `src/i18n/en.ts` and `src/i18n/ar.ts`.

### Testing

Unit tests use Jest with `jest-expo` preset. Run with `pnpm test`.

```bash
pnpm test                                    # Run all tests
pnpm test -- src/services/__tests__/foo.test.ts  # Run single file
```

Test files live next to source: `src/services/__tests__/`, `src/utils/__tests__/`, `src/features/transactions/__tests__/`. Mock `expo-secure-store` with in-memory Map, mock `axios` with `axios-mock-adapter` for service tests, use `jest.useFakeTimers()` for timing tests, `renderHook` from `@testing-library/react-native` for hook tests.

## Key references

- **Flutter source:** `../finance_mobile/lib/` — read this for exact API contracts, request/response shapes, validation, error handling
- **Migration plan:** `EXPO_MIGRATION_PLAN.md` — phases 0-8, business requirements, current status
- **Design system:** `docs/design-system.md` — colors, typography, spacing, component specs
- **API base:** dev `http://192.168.100.53:3000`, prod `https://ruqaqa.sa`. All mobile routes under `/api/mobile/`
- **Auth:** Keycloak at `auth.ruqaqa.sa`, realm `ruqaqa`, client `ruqaqa-mobile-app`

## Conventions

- Use **pnpm**, not npm
- Do not run build/deploy commands directly — give the command for the user to run
- TypeScript strict mode. Path alias: `@/` → `src/`
- Design system follows ruqaqa-website (not Flutter's old design)
- i18n keys in camelCase
- Client-side permission checks are UX-only — the backend is the security boundary
