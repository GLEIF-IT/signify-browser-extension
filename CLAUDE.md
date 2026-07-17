# CLAUDE.md — vLEI Wallet Browser Extension

## Project Purpose

vLEI Wallet is a Manifest V3 browser extension for Chrome and Firefox. It connects to a
KERIA agent via `signify-ts` to manage KERI Autonomic Identifiers (AIDs) and ACDC verifiable
credentials (vLEI). Users can sign in to KERIA-enabled websites using cryptographically
signed HTTP headers. No private keys or passcodes ever leave the background service worker.

## Architecture — 4 Layers

```
Background service worker (src/pages/background/)
  └─ Holds SignifyClient. Handles all sensitive operations. Message coordinator.
Popup UI (src/pages/popup/)
  └─ Extension popup UI. Routes to Signin / Signup / Config / Main screens.
Content script (src/pages/content/)
  └─ Injected into active tab. Relays messages between web page and background.
Dialog (src/pages/content/dialog/)
  └─ HTML overlay injected by content script. Prompts user to authorize sign-in.
```

## Dev Commands

```bash
npm install               # install dependencies
npm run build             # build for Chrome → dist/chrome/
npm run build:firefox     # build for Firefox → dist/firefox/
npm run dev               # watch mode via nodemon
npm run build:icons       # regenerate PNG icons from vlei-wallet-extension-logo.svg
npm run build:crx         # build Chrome + pack signed CRX → dist/vlei-wallet.crx (+ update_manifest.xml)
npm run crx:id            # print the extension ID + manifest key for the signing key
```

Load the built extension: Chrome → chrome://extensions → Developer mode → Load unpacked → dist/chrome/

## Distribution

Internal (non-CWS) distribution is self-hosted: a signed CRX + `update_manifest.xml`
published to GitHub Pages (`publish.yml` on `v*` tags) and force-installed
via an enterprise policy (FileWave).

## Path Aliases (vite.config.ts)

| Alias | Resolves to |
|---|---|
| `@src` | `src/` |
| `@assets` | `src/assets/` |
| `@pages` | `src/pages/` |
| `@components` | `src/components/` |
| `@config` | `src/config/` |
| `@shared` | `src/shared/` |

## Message Passing

All messages use typed constants from `src/config/event-types.ts`. Prefix conventions:

| Prefix | Direction |
|---|---|
| `cs-` | content script → background |
| `ui-` | popup → background |
| `external-` | external web page → background |
| `sw-` | service worker internal |

To add a new event type:
1. Add a constant to the appropriate `*_EVENTS` object in `src/config/event-types.ts`
2. Write a handler function in `src/pages/background/handlers/`
3. Register it in the handler map in `src/pages/background/handlers/index.ts`

## Vendor Theming System

`src/config/vendor.json` is the default GLEIF brand config. External vendors can host their
own JSON matching the `IVendorData` interface at a URL, which the extension fetches on first
run. The theme is merged using `mergeVendorTheme()` and applied via styled-components
`ThemeProvider`.

**To add a new color token:**
1. Add it as optional in `IVendorData.theme.colors` in `src/config/types.ts`
2. Set a default value in `src/config/vendor.json`
3. Use `${({ theme }) => theme?.colors?.yourToken}` in styled-components

## Security Rules

- Sensitive data (passcode, `SignifyClient` instance) lives only in the background service worker
- Passcode is zeroed after 5 minutes of inactivity (`PASSCODE_TIMEOUT` in `signify-connection.ts`)
- Content script never receives passcodes or private key material
- Signed headers are only generated if a signing association exists for the requesting domain
- No `eval()`, no external scripts loaded in the extension
- Background only processes messages from the active tab or the popup

## File Conventions

- **Components:** PascalCase filenames, each folder has a barrel `index.ts`
- **Services:** camelCase factory function returning a singleton (`configService`, `signifyService`)
- **Icons:** `src/components/shared/icons/` — each icon is a React functional component accepting a `size: number` prop
- **Hooks:** `useCamelCase.ts` — placed alongside the component or in `src/config/` if shared

## Background Services

| Service | File | Responsibility |
|---|---|---|
| `signifyConnectionService` | `services/signify-connection.ts` | SignifyClient lifecycle, alarms, passcode timeout |
| `signifyOperationsService` | `services/signify-operations.ts` | AID/credential/session operations |
| `signifyService` | `services/signify.ts` | Combined re-export facade (use this in handlers) |
| `configService` | `services/config.ts` | Vendor URL, agent URL, boot URL, permissions |
| `sessionService` | `services/session.ts` | Per-tab session tracking |
| `userService` | `services/user.ts` | Controller ID, passcode storage |
| `browserStorageService` | `services/browser-storage.ts` | chrome.storage.local abstraction |
| `sessionStorageService` | `services/browser-storage.ts` | chrome.storage.session abstraction |

## Known Tech Debt

- `signify-ts` is pinned to `0.3.0-rc1` — track upstream for stable release
- No unit or integration test suite — Vitest setup is planned as a follow-on
- Handler `data` params are typed `any` in `IHandler` — typed data interfaces are planned per handler
