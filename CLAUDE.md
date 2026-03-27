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

### Maestro E2E tests

Tests live in `.maestro/`. Env vars for login tests are in `.maestro/.env` (gitignored).

```bash
# Run a single flow with credentials
maestro test -e TEST_USERNAME=user -e TEST_PASSWORD=pass .maestro/keycloak-sso-login.yaml

# Run all flows
pnpm test:e2e
```

Key points:
- Use `- launchApp` without `clearState` or `clearKeychain` — both break Metro on dev builds
- Clear app data once before the suite via `adb shell pm clear sa.ruqaqa.finance`
- Use `optional: true` on `tapOn` for elements that may not appear (e.g., version gate)
- Brave browser is the default on the test device (avoids Chrome's autofill/welcome issues)

## Architecture

### Routing (Expo Router, file-based)

- `app/_layout.tsx` — Root: ThemeProvider → AuthProvider → VersionGate → SessionExpiredModal
- `app/index.tsx` — Auth gate: redirects to `/login` or `/(app)` based on session
- `app/login.tsx` — SSO login (Microsoft + Keycloak buttons)
- `app/auth/callback.tsx` — OAuth redirect handler
- `app/(app)/_layout.tsx` — Authenticated shell: Finance/Gallery module switcher with permission gating

### Auth flow

1. `AuthProvider` (context) wraps entire app, restores session from secure storage on mount
2. SSO uses `expo-auth-session` with PKCE → opens Keycloak in system browser → redirect back via `ruqaqa://auth/callback`
3. `postLoginValidation()` pipeline: decode JWT → check `mobile_signin` role → extract permissions → validate employee via `/api/mobile/auth/validate`
4. `apiClient.ts` (Axios): attaches Bearer token, proactively refreshes 30s before expiry, retries once on 401
5. Session expiration: shows `SessionExpiredModal` overlay → user acknowledges → clears state → redirects to login

### Navigation shells

`app/(app)/_layout.tsx` uses an IndexedStack pattern — both `FinanceShell` and `GalleryShell` are always mounted (preserves state). Only the active module is displayed via `display: flex/none`.

- **FinanceShell**: tabs for Operations, Reconciliation, Payroll
- **GalleryShell**: tabs for Albums, Upload
- Tabs are permission-gated via `getAvailableFinanceTabs()`
- Module switching via `ModuleSwitcherSheet` bottom sheet

### Services

| Service | Role |
|---------|------|
| `authService.ts` | Keycloak token exchange (PKCE + password grant), refresh, employee validation, server logout. Uses `withRetry()` exponential backoff |
| `authContext.ts` | React context: session state, login/logout, AppState listener for foreground refresh |
| `apiClient.ts` | Axios: auto Bearer, proactive refresh, 401 retry, `uploadMultipart()` helper |
| `tokenStorage.ts` | `expo-secure-store` wrapper with chunking for large JWTs (1800-byte chunks), crash-safe write order |
| `permissionService.ts` | Extracts 16 permission flags from JWT roles. `getAvailableModules()`, `getAvailableFinanceTabs()` |
| `versionCheckService.ts` | `/api/mobile/version-check` → forced update, optional update, maintenance mode |
| `config.ts` | Dev/prod URLs keyed on `releaseChannel` from `app.json` |

### Theme & design system

`ThemeProvider` exposes `useTheme()` → `{ colors, typography, spacing, radius, shadows }`. Supports light/dark mode. Design derived from ruqaqa-website, documented in `docs/design-system.md`.

Use theme tokens in styles, not raw values. Use `start/end` instead of `left/right` for RTL support.

### i18n

`i18next` + `react-i18next`. Arabic and English with runtime switching. RTL applied via `I18nManager.forceRTL()`. Keys are camelCase: `t('signInWithMicrosoft')`. Strings in `src/i18n/en.ts` and `src/i18n/ar.ts`.

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
