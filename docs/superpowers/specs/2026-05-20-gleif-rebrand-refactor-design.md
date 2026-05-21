# GLEIF Rebrand + Structural Refactor — Design Spec

**Date:** 2026-05-20
**Status:** Approved
**Approach:** B — Structured Rebrand + Moderate Refactor

---

## Overview

This spec covers three parallel workstreams for the `signify-browser-extension` (vLEI Wallet):

1. **CLAUDE.md** — Project guidance file for AI assistants and developers
2. **GLEIF Branding** — Replace the legacy blue palette with the official GLEIF 2024 brand (Cyprus + Turquoise), new SVG logo, updated font stack
3. **Structural Refactor** — Split large files, extract hooks, moderate TypeScript improvements, dead code removal

No new runtime dependencies are added. The vendor theming system (`vendor.json` → `IVendorData` → `ThemeProvider`) is preserved and strengthened.

---

## 1. CLAUDE.md

### Location
`/CLAUDE.md` (repo root)

### Sections

**Project purpose**
vLEI Wallet is a Manifest V3 browser extension for Chrome and Firefox. It connects to a KERIA agent via `signify-ts` to manage KERI Autonomic Identifiers (AIDs) and ACDC verifiable credentials. Users can sign in to KERIA-enabled websites using signed HTTP headers. No private keys ever leave the background service worker.

**Architecture — 4 layers**
- **Background service worker** (`src/pages/background/`) — all sensitive operations; holds the `SignifyClient` instance; communicates with KERIA agent; processes messages from popup, content script, and external pages
- **Popup UI** (`src/pages/popup/`) — extension popup; renders `Popup.tsx`; routes to Signin / Signup / Config / Main screens
- **Content script** (`src/pages/content/`) — injected into active tab; relays messages between web page and background; renders the Dialog overlay in the page DOM
- **Dialog** (`src/pages/content/dialog/`) — HTML injected by content script; prompts the user to authorize sign-in or credential requests

**Message passing**
All messages use typed event constants from `src/config/event-types.ts`. Prefix conventions:
- `cs-` — content script → background
- `ui-` — popup → background
- `external-` — external web page → background
- `sw-` — service worker internal

To add a new event: add a constant to the appropriate `*_EVENTS` object, add a handler in `src/pages/background/handlers/`, register it in `src/pages/background/index.ts`.

**Dev commands**
```bash
npm install          # install deps
npm run build        # build for Chrome → dist/chrome/
npm run build:firefox # build for Firefox → dist/firefox/
npm run dev          # watch mode via nodemon
node scripts/build-extension-icons.mjs  # regenerate icons from SVG source
```

**Path aliases** (defined in `vite.config.ts`)
- `@src` → `src/`
- `@assets` → `src/assets/`
- `@pages` → `src/pages/`
- `@components` → `src/components/`
- `@config` → `src/config/`
- `@shared` → `src/shared/`

**Vendor theming system**
`src/config/vendor.json` is the default GLEIF brand config. External vendors can supply a URL pointing to their own JSON matching the `IVendorData` interface. At runtime:
1. `configService.getAgentAndVendorInfo()` fetches stored vendor data
2. `mergeVendorTheme()` deep-merges vendor theme over the defaults
3. The result is passed to `styled-components` `ThemeProvider`

When adding new color tokens, add them to `IVendorData.theme.colors` in `src/config/types.ts` and set defaults in `vendor.json`.

**Security rules**
- Sensitive data (passcode, `SignifyClient`) stays in background service worker only
- Passcode is zeroed after 5 minutes idle (configurable via `PASSCODE_TIMEOUT`)
- Content script only receives non-sensitive data
- Signed headers are only returned if a signing association exists for the requesting domain
- No `eval()`, no external scripts in the extension

**File conventions**
- Components: PascalCase files, barrel `index.ts` in each folder
- Services: camelCase factory functions returning a singleton (e.g., `configService`, `signifyService`)
- Icons: `src/components/shared/icons/` — each icon is a React component accepting a `size` prop

**Known tech debt**
- `IHandler.data` is typed `any` — gradual improvement in progress
- `signify-ts` peer still at `0.3.0-rc1` — track upstream for stable release
- No unit or integration test suite yet — Vitest setup is planned

---

## 2. GLEIF Branding

### Color Token Migration

Replace `vendor.json` `theme.colors` values to align with `src/assets/gleif-tokens.css`.

| Token | Old value | New value | Notes |
|---|---|---|---|
| `primary` | `#003DA5` | `#003336` | `--gleif-cyprus` (brand anchor) |
| `secondary` | `#041E3A` | `#027361` | `--gleif-fern` (deep accent) |
| `error` | `#C41230` | `#DC2626` | `--color-error` |
| `heading` | `#0A2540` | `#003336` | `--gleif-cyprus` |
| `text` | `#4A5B6C` | `#000000` | `--gleif-black` (body copy) |
| `subtext` | `#F4F7FB` | `#FFFFFF` | `--gleif-white` |
| `white` | `#FFFFFF` | `#FFFFFF` | unchanged |
| `black` | `#0F1729` | `#000000` | `--gleif-black` |
| `bodyBg` | `#EEF2F7` | `#F0F0F0` | `--color-surface-2` |
| `bodyBorder` | `#B8C9DC` | `#D4D4D4` | `--color-border` |
| `bodyColor` | `#003DA5` | `#003336` | `--gleif-cyprus` |
| `cardColor` | `#0A2540` | `#003336` | `--gleif-cyprus` |
| `cardBg` | `#FFFFFF` | `#FFFFFF` | unchanged |
| `muted` | `#9BAEC2` | `#6A7B7F` | `--gleif-smoke` |
| `success` | `#047857` | `#16A34A` | `--color-success` |
| `danger` | `#B91C1C` | `#DC2626` | `--color-error` |
| `sidebarMuted` | `#9BB0C8` | `#6A7B7F` | `--gleif-smoke` |
| `surface` | `#F8FAFC` | `#FFFFFF` | `--gleif-white` |
| `border` | `#D7E2EE` | `#D4D4D4` | `--color-border` |
| `onPrimary` | `#FFFFFF` | `#003336` | Cyprus on Turquoise CTA |
| **`accent`** | _(new)_ | `#51DAC5` | `--gleif-turquoise` — add to IVendorData |

The primary **button** background should use `accent` (turquoise `#51DAC5`) for the CTA per GLEIF guidelines, with Cyprus text (`onPrimary: #003336`).

### Typography

Update `GlobalStyles` in `Popup.tsx` to the official GLEIF font stack:
```css
font-family: "Facundo", "Calibri", system-ui, -apple-system, "Segoe UI",
             "Helvetica Neue", Arial, sans-serif;
```
Facundo is a licensed font. If not installed, Calibri renders correctly per GLEIF guidelines.

### New SVG Logo

**File:** `src/assets/img/vlei-wallet-extension-logo.svg` (replace in-place)

Design: wordmark-style SVG
- Viewbox: `0 0 128 128` — **must be square** because `scripts/build-extension-icons.mjs` reads this exact file and passes it to `sharp().resize(size, size)` for all icon sizes; a rectangular viewbox would produce distorted icons
- Cyprus `#003336` square background (full viewbox fill)
- "vLEI" centered, white `#FFFFFF`, bold weight (~700), Calibri/sans-serif, large size (~36px equivalent)
- "Wallet" below, white, lighter weight, smaller size (~14px equivalent)
- Turquoise `#51DAC5` horizontal accent bar (4px) between "vLEI" and "Wallet"

In the **sidebar header** (`src/components/sidebar/header.tsx`), the logo is rendered as an `<img>` with CSS constraining its height. The 128×128 square will display fine at any constrained size.

### `useVendorTheme` Hook

**File:** `src/config/useVendorTheme.ts`

Encapsulates:
- `vendorData` state (`IVendorData`)
- `checkIfVendorDataExists()` — reads from `configService`, applies `mergeVendorTheme()`
- Returns `{ vendorData, checkIfVendorDataExists }`

`Popup.tsx` imports this hook instead of managing vendor state inline.

---

## 3. Structural Refactor

### 3.1 Split `signify.ts`

**Current:** `src/pages/background/services/signify.ts` — 503 lines, handles connection AND operations

**After:**

`src/pages/background/services/signify-connection.ts`
- Internal `_client: SignifyClient | null`
- `getClient()` — throws if null (replaces `validateClient`)
- `connect()`, `bootAndConnect()`, `disconnect()`, `isConnected()`, `getState()`
- `generatePasscode()`, `getControllerID()`
- Alarm management (`setTimeoutAlarm`, `resetTimeoutAlarm`)
- Exports: `signifyConnectionService`

`src/pages/background/services/signify-operations.ts`
- Imports `signifyConnectionService` to get the client
- `listIdentifiers()`, `listCredentials()`, `getCredential()`
- `createAID()`, `createCredential()`, `isGroupAid()`
- `authorizeSelectedSignin()`, `getSessionInfo()`, `removeSessionInfo()`
- `createAttestationCredential()`, `getCreateCredentialPrerequisites()`
- Exports: `signifyOperationsService`

`src/pages/background/services/signify.ts` (thin re-export for backwards compat)
```ts
export { signifyConnectionService } from './signify-connection';
export { signifyOperationsService } from './signify-operations';
// Combined service for handlers that need both
export const signifyService = {
  ...signifyConnectionService,
  ...signifyOperationsService,
};
```

### 3.2 `usePopup` Hook

**File:** `src/pages/popup/usePopup.ts`

State managed by hook:
- `vendorData` (from `useVendorTheme`)
- `showConfig`, `showSignup`
- `permissionData`, `isConnected`, `isLoading`
- `connectError`, `isCheckingInitialConnection`

Handlers extracted:
- `handleBootAndConnect(passcode)`
- `handleConnect(passcode)`
- `handleDisconnect()`
- `handleDisconnectPermission()`
- `checkConnection()`
- `checkWebRequestedPermissions()`

`Popup.tsx` becomes ~60 lines of pure render JSX.

### 3.3 TypeScript Improvements (Moderate)

Make `IHandler` generic:
```ts
// src/config/types.ts
export interface IHandler<T = unknown> {
  sendResponse: (response?: any) => void;
  tabId?: number;
  url?: string;
  data?: T;
}
```

Update handler signatures in `src/pages/background/handlers/authentication.ts` and `resource.ts` to use the generic parameter where the data shape is known.

### 3.4 Dead Code Removal

- Remove `tailwind.config.cjs` (Tailwind is not in `package.json` dependencies)
- Remove commented-out imports and plugin blocks in `vite.config.ts` (crxjs, nodePolyfills)
- Remove unused `manifest.dev.json` references if no longer consumed

---

## Files Touched Summary

| File | Change |
|---|---|
| `CLAUDE.md` | **Create** |
| `src/config/vendor.json` | Replace all color values |
| `src/config/types.ts` | Add `accent` to theme colors; make `IHandler` generic |
| `src/config/useVendorTheme.ts` | **Create** (extract from Popup.tsx) |
| `src/pages/popup/usePopup.ts` | **Create** (extract from Popup.tsx) |
| `src/pages/popup/Popup.tsx` | Slim down to ~60 lines; use hooks |
| `src/pages/background/services/signify.ts` | Become thin re-export |
| `src/pages/background/services/signify-connection.ts` | **Create** |
| `src/pages/background/services/signify-operations.ts` | **Create** |
| `src/pages/background/handlers/authentication.ts` | Use generic IHandler |
| `src/pages/background/handlers/resource.ts` | Use generic IHandler |
| `src/assets/img/vlei-wallet-extension-logo.svg` | Replace with new square (128×128) wordmark SVG |
| `tailwind.config.cjs` | **Delete** |
| `vite.config.ts` | Remove commented-out blocks |
| `README.md` | Minor update: add link to CLAUDE.md |

---

## Out of Scope

- Full TypeScript strict mode (`noImplicitAny` globally) — Approach C only
- Test suite (Vitest/Playwright) — Approach C only
- `styled-system` replacement — low priority, no user request
- `signify-ts` version upgrade — separate PR, API compatibility unknown
