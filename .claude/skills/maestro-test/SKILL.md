---
name: maestro-test
description: "Create or modify Maestro E2E test flows for the Expo mobile app. Use when the user asks to write, fix, or update Maestro tests."
---

# Maestro E2E Test Skill

When creating or modifying Maestro E2E test flows in `.maestro/`, follow these rules strictly.

## Project context

- App ID: `sa.ruqaqa.app`
- Maestro flows live in `.maestro/` directory
- Credentials are in `.maestro/.env` (gitignored), passed via `-e` flags
- Test device uses **Brave browser** (`com.brave.browser`) as default — not Chrome
- Metro dev server runs on port **5173**
- Run flows with: `export PATH="$HOME/.maestro/bin:$PATH" && maestro test .maestro/<flow>.yaml`
- Run with credentials: `maestro test -e TEST_USERNAME=... -e TEST_PASSWORD=... .maestro/<flow>.yaml`

## Mandatory rules

### Timeouts
- **Maximum timeout: 10 seconds** for ALL `extendedWaitUntil` commands
- If something doesn't appear in 10s, it's a real problem — don't wait longer
- Never use timeouts > 10000

### App launch pattern
Always use this pattern at the start of every flow:
```yaml
- launchApp
# Wait for content first, THEN optionally skip version gate
- extendedWaitUntil:
    visible: "Sign in with SSO|Update now"
    timeout: 10000
- tapOn:
    id: "dev-skip-update"
    optional: true
```

**Why this order matters:** If you put the optional `tapOn` before `extendedWaitUntil`, Maestro wastes time waiting for the missing element before moving on. Wait for actual content first, then skip the gate.

### Never use `clearState` or `clearKeychain` with `launchApp`
```yaml
# WRONG — breaks Metro dev connection
- launchApp:
    clearState: true

# RIGHT — use standalone clearState before launchApp
- clearState: sa.ruqaqa.app
- launchApp
```

### Optional taps — keep them minimal
Each `optional: true` tap that fails wastes ~3-5 seconds scanning for the element. Only add optional taps for elements you've confirmed actually appear. Don't add speculative "just in case" optional taps.

### Use `testID` over text matching when possible
Prefer `id:` (maps to `testID` in React Native) over `text:` — it's faster and locale-independent.

### Brave browser considerations
- Brave is the default browser on the test device
- Clearing Brave (`clearState: com.brave.browser`) triggers its first-run onboarding
- If you must clear Brave, dismiss onboarding with exactly these two taps:
  ```yaml
  - tapOn:
      text: "Maybe Later"
      optional: true
  - tapOn:
      text: "Continue"
      optional: true
  ```
- **Only clear Brave in flows that specifically need a fresh browser session** (e.g., `keycloak-sso-fresh-login.yaml`)
- Normal login flows should NOT clear Brave — use `runFlow` with `when` to handle both fresh and cached sessions

### Handling SSO login (two patterns)

**Pattern 1: Login that works with or without existing browser session**
```yaml
- tapOn:
    id: "sso-keycloak-button"
- extendedWaitUntil:
    visible: "Username or email|Operations|Reconciliation"
    timeout: 10000
- runFlow:
    when:
      visible: "Username or email"
    commands:
      - tapOn: "Username or email"
      - inputText: "${TEST_USERNAME}"
      - tapOn: "Password"
      - inputText: "${TEST_PASSWORD}"
      - pressKey: back
      - scrollUntilVisible:
          element: "Sign In"
          direction: DOWN
      - tapOn: "Sign In"
- extendedWaitUntil:
    visible: "Operations|Reconciliation"
    timeout: 10000
```

**Pattern 2: Fresh login (forces credential entry)**
Clear Brave + app state first, then assert Keycloak form appears (no `runFlow` conditional):
```yaml
- clearState: com.brave.browser
- clearState: sa.ruqaqa.app
- launchApp
# ... (app launch pattern) ...
- tapOn:
    id: "sso-keycloak-button"
# Dismiss Brave onboarding
- tapOn:
    text: "Maybe Later"
    optional: true
- tapOn:
    text: "Continue"
    optional: true
# Keycloak form MUST appear
- extendedWaitUntil:
    visible: "Username or email"
    timeout: 10000
```

### After `clearState: sa.ruqaqa.app`
Metro port forward is dropped. The test script (`pnpm test:e2e`) handles re-forwarding. If running manually, you need `adb reverse tcp:5173 tcp:5173` before the flow or the app won't connect to Metro.

## Flow file structure

```yaml
appId: sa.ruqaqa.app
env:                          # Only if credentials needed
  TEST_USERNAME: ${TEST_USERNAME}
  TEST_PASSWORD: ${TEST_PASSWORD}
tags:                         # Optional
  - auth
---
# Brief description of what this flow tests
- launchApp
# ... steps ...
```

## Existing flows reference

| Flow | Purpose |
|------|---------|
| `config.yaml` | Global config (appId only) |
| `splash-screen.yaml` | App bootstrap reaches version gate or login |
| `app-launch.yaml` | App loads, login screen with both SSO buttons |
| `login-screen-elements.yaml` | All login screen elements present |
| `language-switch.yaml` | English/Arabic toggle works |
| `keycloak-sso-login.yaml` | SSO login (handles cached browser session) |
| `keycloak-sso-fresh-login.yaml` | Full clean login (clears browser + app) |

## Common mistakes to avoid

1. **Long timeouts** — Never exceed 10s. If it's slow, the test or app has a problem.
2. **Speculative optional taps** — Each wasted optional tap = 3-5s delay. Only add what you've confirmed appears.
3. **Waiting for version gate** — The version gate may or may not appear depending on app version. Always use the `|` OR pattern.
4. **Clearing Brave unnecessarily** — Only `keycloak-sso-fresh-login` needs this. All other flows should handle existing browser sessions gracefully.
5. **Using `launchApp` with `clearState: true`** — Breaks Metro. Use standalone `clearState` command instead.
6. **Forgetting `pressKey: back`** — After filling the password field, dismiss the keyboard before trying to tap "Sign In".
