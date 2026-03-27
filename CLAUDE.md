# CLAUDE.md — finance_mobile_expo

## What is this project?

Expo (React Native + TypeScript) mobile app for Ruqaqa employees. It's a migration from the Flutter app at `../finance_mobile/lib/` — that codebase is the source of truth for business logic, API contracts, validation rules, and edge cases.

## Commands

```bash
pnpm start              # Metro dev server (port 5173)
pnpm android:build      # Build + install native APK on device
pnpm ios:build          # Build + install on iOS device/sim
pnpm android            # Start Metro for Android
pnpm ios                # Start Metro for iOS
```

## Architecture

- `app/` — Expo Router screens (file-based routing)
- `src/theme/` — Design system (colors, typography, spacing, shadows) derived from ruqaqa-website
- `src/i18n/` — Arabic/English localization with RTL support
- `src/services/` — API client (auto Bearer token, 401 refresh), token storage, permissions, config
- `src/components/ui/` — Reusable components: Button, Input, Card, Badge, StatusChip
- `src/components/layout/` — AppBar, ModuleSwitcherSheet, NoAccessScreen
- `src/navigation/` — Finance/Gallery shell navigation with permission-gated tabs
- `src/features/` — Feature domains (transactions, reconciliation, payroll, gallery, permissions)
- `docs/design-system.md` — Complete design system reference (no need to check ruqaqa-website)

## Key references

- **Flutter source:** `../finance_mobile/lib/` — refer to this for exact API contracts, request/response shapes, validation, error handling
- **Migration plan:** `EXPO_MIGRATION_PLAN.md` — phases, status, business requirements
- **API base:** dev `http://192.168.100.53:3000`, prod `https://ruqaqa.sa`. All mobile routes under `/api/mobile/`
- **Auth:** Keycloak SSO at `auth.ruqaqa.sa`

## Conventions

- Use **pnpm**, not npm
- Do not run build/deploy commands directly — give the command for the user to run
- Design system follows ruqaqa-website (not Flutter's old design). See `docs/design-system.md`
