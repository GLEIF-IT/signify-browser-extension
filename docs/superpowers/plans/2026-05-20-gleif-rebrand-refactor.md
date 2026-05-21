# GLEIF Rebrand + Structural Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply official GLEIF 2024 branding (Cyprus/Turquoise palette, new logo, Facundo font stack), add CLAUDE.md project guidance, and structurally refactor the codebase by splitting the monolithic `signify.ts` service and extracting React hooks from `Popup.tsx`.

**Architecture:** The vendor theming system (`vendor.json` → `IVendorData` → `ThemeProvider`) is preserved intact. Branding changes flow through `vendor.json`. Structural changes split `signify.ts` into two focused files and extract hook logic from `Popup.tsx`, keeping the public API the same for all callers.

**Tech Stack:** React 18, TypeScript, styled-components, signify-ts, webextension-polyfill, Vite, vite-plugin-web-extension

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `CLAUDE.md` | Create | AI/developer project guidance |
| `tailwind.config.cjs` | Delete | Unused — Tailwind not in dependencies |
| `vite.config.ts` | Modify | Remove commented-out dead code |
| `src/pages/background/index.ts` | Modify | Remove commented-out external message listener block |
| `src/config/vendor.json` | Modify | Replace all color values with GLEIF 2024 brand |
| `src/config/types.ts` | Modify | Add `accent` color token; make `IHandler<T>` generic |
| `src/assets/img/vlei-wallet-extension-logo.svg` | Replace | New 128×128 square wordmark SVG |
| `src/pages/popup/Popup.tsx` | Modify | Update font stack; use `useVendorTheme` + `usePopup` hooks |
| `src/config/useVendorTheme.ts` | Create | Extract vendor theme state and loading from Popup.tsx |
| `src/pages/popup/usePopup.ts` | Create | Extract all state + handlers from Popup.tsx |
| `src/pages/background/services/signify-connection.ts` | Create | Client lifecycle: connect, disconnect, isConnected, alarms |
| `src/pages/background/services/signify-operations.ts` | Create | Data operations: identifiers, credentials, sessions, attestation |
| `src/pages/background/services/signify.ts` | Modify | Thin re-export combining both services |
| `src/pages/background/handlers/authentication.ts` | Modify | Use `IHandler<T>` generic |
| `src/pages/background/handlers/resource.ts` | Modify | Use `IHandler<T>` generic |
| `README.md` | Modify | Add link to CLAUDE.md |

---

## Task 1: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md` at the repo root**

```markdown
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
node scripts/build-extension-icons.mjs  # regenerate PNG icons from vlei-wallet-extension-logo.svg
```

Load the built extension: Chrome → chrome://extensions → Developer mode → Load unpacked → dist/chrome/

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
| `signifyService` | `services/signify.ts` | Combined re-export (use this in handlers) |
| `configService` | `services/config.ts` | Vendor URL, agent URL, boot URL, permissions |
| `sessionService` | `services/session.ts` | Per-tab session tracking |
| `userService` | `services/user.ts` | Controller ID, passcode storage |
| `browserStorageService` | `services/browser-storage.ts` | chrome.storage.local abstraction |
| `sessionStorageService` | `services/browser-storage.ts` | chrome.storage.session abstraction |

## Known Tech Debt

- `signify-ts` is pinned to `0.3.0-rc1` — track upstream for stable release
- No unit or integration test suite — Vitest setup is planned as a follow-on
- Some handler data params are still typed `unknown` pending typed data interfaces per handler
```

- [ ] **Step 2: Build to verify no issues introduced**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors. The new CLAUDE.md has no effect on the build.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project architecture, dev workflow, and conventions"
```

---

## Task 2: Dead Code Cleanup

**Files:**
- Delete: `tailwind.config.cjs`
- Modify: `vite.config.ts`
- Modify: `src/pages/background/index.ts`

- [ ] **Step 1: Delete `tailwind.config.cjs`**

Tailwind CSS is not listed as a dependency in `package.json`. The config file is a leftover.

```bash
rm tailwind.config.cjs
```

- [ ] **Step 2: Clean `vite.config.ts`** — remove all commented-out imports and plugin code

Replace the full file content with:

```typescript
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

const rootDir = resolve(__dirname, "src");
const publicDir = resolve(__dirname, "public");
const isDev = process.env.__DEV__ === "false";
const targetBrowser = process.env.BROWSER || "chrome";
const outDir = resolve(__dirname, `dist/${targetBrowser}`);

function generateManifest() {
  const manifest = readJsonFile(`manifest.${targetBrowser}.json`);
  const pkg = readJsonFile("package.json");
  return {
    ...manifest,
    name: pkg.displayName ?? pkg.name,
    description: pkg.description,
    version: pkg.version,
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@src": rootDir,
      "@assets": resolve(rootDir, "assets"),
      "@pages": resolve(rootDir, "pages"),
      "@components": resolve(rootDir, "components"),
      "@config": resolve(rootDir, "config"),
      "@shared": resolve(rootDir, "shared"),
    },
  },
  plugins: [
    react(),
    webExtension({
      manifest: generateManifest,
    }),
  ],
  publicDir,
  build: {
    outDir,
    sourcemap: isDev,
    emptyOutDir: false,
  },
});
```

- [ ] **Step 3: Clean `src/pages/background/index.ts`** — remove the commented-out external message listener block (lines 79–94)

Replace the full file content with:

```typescript
import browser from "webextension-polyfill";
import { configService } from "@pages/background/services/config";
import { sessionStorageService } from "@pages/background/services/browser-storage";
import { IMessage } from "@config/types";
import { senderIsPopup } from "@pages/background/utils";
import { setActionIcon } from "@shared/browser/action-utils";
import { initCSHandler, initUIHandler } from "@pages/background/handlers";

console.log("Background script loaded");

const csHandler = initCSHandler();
const uiHandler = initUIHandler();
const SAVE_TIMESTAMP_INTERVAL_MS = 2 * 1000;

function saveTimestamp() {
  const timestamp = new Date().toISOString();
  sessionStorageService.setValue("timestamp", timestamp);
}

browser.runtime.onStartup.addListener(function () {
  (async () => {
    const vendorData = await configService.getVendorData();
    if (vendorData?.icon) {
      setActionIcon(vendorData?.icon);
    }
  })();
  return true;
});

browser.runtime.onInstalled.addListener(function (object) {
  if (object.reason === "install") {
    console.log("Signify Browser Extension installed");
  }
});

browser.runtime.onMessage.addListener(function (
  message: IMessage<any>,
  sender,
  sendResponse
) {
  (async () => {
    if (sender.tab && sender.tab.active && !senderIsPopup(sender)) {
      console.log("Message received from content script at ", sender?.tab?.url);
      console.log("Message Type", message.type);
      const processor = csHandler.get(message.type);
      if (processor) {
        processor({
          sendResponse,
          tabId: sender?.tab?.id,
          url: sender?.url,
          data: message?.data,
        });
      }
    } else if (senderIsPopup(sender)) {
      console.log("Message received from popup: ", message.type);
      const processor = uiHandler.get(message.type);
      if (processor) {
        processor({
          sendResponse,
          tabId: sender?.tab?.id,
          url: sender?.url,
          data: message?.data,
        });
      }
    }
  })();
  return true;
});

async function initBackground() {
  saveTimestamp();
  setInterval(saveTimestamp, SAVE_TIMESTAMP_INTERVAL_MS);
}
initBackground();
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (tailwind config, commented vite plugins, commented bg listener)"
```

---

## Task 3: GLEIF Brand Color Tokens

**Files:**
- Modify: `src/config/vendor.json`
- Modify: `src/config/types.ts`

- [ ] **Step 1: Replace `src/config/vendor.json` with GLEIF 2024 palette**

The token mapping from `src/assets/gleif-tokens.css`:

```json
{
  "title": "vLEI Wallet",
  "logo": "/vlei-wallet-extension-logo.svg",
  "onboardingUrl": "https://www.gleif.org/en/vlei/introducing-the-verifiable-lei-vlei",
  "docsUrl": "https://www.gleif.org/en/vlei/introducing-the-verifiable-lei-vlei",
  "supportUrl": "https://github.com/gleif-it/signify-browser-extension/issues",
  "theme": {
    "colors": {
      "primary": "#003336",
      "secondary": "#027361",
      "accent": "#51DAC5",
      "error": "#DC2626",
      "heading": "#003336",
      "text": "#000000",
      "subtext": "#FFFFFF",
      "white": "#FFFFFF",
      "black": "#000000",
      "bodyBg": "#F0F0F0",
      "bodyBorder": "#D4D4D4",
      "bodyColor": "#003336",
      "cardColor": "#003336",
      "cardBg": "#FFFFFF",
      "muted": "#6A7B7F",
      "success": "#16A34A",
      "danger": "#DC2626",
      "sidebarMuted": "#6A7B7F",
      "surface": "#FFFFFF",
      "border": "#D4D4D4",
      "onPrimary": "#003336"
    }
  }
}
```

- [ ] **Step 2: Add `accent` token to `IVendorData` in `src/config/types.ts`**

Open `src/config/types.ts`. In `IVendorData.theme.colors`, add the `accent` field after `secondary`:

```typescript
export interface IVendorData {
  title: string;
  logo?: string;
  icon?: string;
  onboardingUrl: string;
  docsUrl: string;
  supportUrl: string;
  theme: {
    colors: {
      primary: string;
      secondary: string;
      /** Turquoise highlight — GLEIF brand accent (#51DAC5) */
      accent?: string;
      error: string;
      heading: string;
      text: string;
      subtext: string;
      white: string;
      black: string;
      bodyBg: string;
      bodyBorder: string;
      bodyColor: string;
      cardColor: string;
      cardBg: string;
      /** Muted UI (disabled buttons, hints) */
      muted?: string;
      /** Success / valid credential */
      success?: string;
      /** Revoked / danger (besides `error`) */
      danger?: string;
      /** Sidebar nav label when not active */
      sidebarMuted?: string;
      /** Main content canvas behind cards */
      surface?: string;
      /** Default card / input border */
      border?: string;
      /** Text on primary-filled controls */
      onPrimary?: string;
    };
  };
}
```

- [ ] **Step 3: Update the primary button to use `accent` as background**

Open `src/components/ui/button/button.tsx`. The `StyledButton` currently uses `primary` as background. Change it to use `accent` when available, falling back to `primary`:

```typescript
const StyledButton = styled.button`
  border: none;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  background-color: ${(props) =>
    props.disabled
      ? props.theme?.colors?.muted ?? "#9BAEC2"
      : props.theme?.colors?.accent ?? props.theme?.colors?.primary};
  text-align: center;
  font-weight: 600;
  border-radius: 10px;
  color: ${(props) =>
    props.disabled
      ? props.theme?.colors?.white
      : props.theme?.colors?.onPrimary ?? props.theme?.colors?.white};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
  padding: 10px 18px;
  min-height: 40px;
  transition: background-color 0.15s ease, transform 0.1s ease,
    box-shadow 0.15s ease;
  box-shadow: ${(props) =>
    props.disabled
      ? "none"
      : "0 1px 2px rgba(0, 51, 54, 0.2), 0 2px 8px rgba(0, 51, 54, 0.15)"};
  &:hover:not(:disabled) {
    filter: brightness(0.94);
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;
```

- [ ] **Step 4: Update font stack in `GlobalStyles` in `src/pages/popup/Popup.tsx`**

Find the `GlobalStyles` declaration. Change the `font-family` line from:
```
font-family: "Source Sans 3", "Segoe UI", system-ui, -apple-system, sans-serif;
```
to:
```
font-family: "Facundo", "Calibri", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
```

The complete updated `GlobalStyles`:

```typescript
export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #__root {
    height: 100%;
    min-height: 386px;
  }

  body {
    font-family: "Facundo", "Calibri", system-ui, -apple-system, "Segoe UI",
                 "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.4;
    letter-spacing: 0.01em;
    background: ${({ theme }) => theme?.colors?.bodyBg};
    color: ${({ theme }) => theme?.colors?.black};
    border: ${({ theme }) =>
      `1px solid ${theme?.colors?.bodyBorder ?? theme?.colors?.bodyBg}`};
    transition: background 0.2s ease-in, color 0.2s ease-in;
  }

  :root {
    --toast-surface: ${({ theme }) => theme?.colors?.secondary ?? "#027361"};
    --toast-on-surface: ${({ theme }) => theme?.colors?.white ?? "#fff"};
  }

  *:focus-visible {
    outline: 2px solid ${({ theme }) => theme?.colors?.accent ?? theme?.colors?.primary};
    outline-offset: 2px;
  }

  ul {
    list-style-type: none;
    padding: 0;

    > li {
      margin-bottom: 8px;
    }
  }
`;
```

- [ ] **Step 5: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors regarding the new `accent` field (it is optional).

- [ ] **Step 6: Commit**

```bash
git add src/config/vendor.json src/config/types.ts src/components/ui/button/button.tsx src/pages/popup/Popup.tsx
git commit -m "feat: apply GLEIF 2024 brand palette (Cyprus/Turquoise) and font stack"
```

---

## Task 4: New Logo SVG

**Files:**
- Replace: `src/assets/img/vlei-wallet-extension-logo.svg`

- [ ] **Step 1: Replace the logo SVG**

The build script (`scripts/build-extension-icons.mjs`) reads this exact file and passes it to `sharp().resize(size, size)` to generate 16/32/48/128px PNG icons. The SVG must be **square** (128×128 viewbox) to avoid distortion.

Write this content to `src/assets/img/vlei-wallet-extension-logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <!-- Cyprus background -->
  <rect width="128" height="128" fill="#003336"/>
  <!-- "vLEI" wordmark — white, bold -->
  <text
    x="64"
    y="52"
    font-family="Calibri, 'Segoe UI', Arial, sans-serif"
    font-size="38"
    font-weight="700"
    fill="#FFFFFF"
    text-anchor="middle"
    dominant-baseline="auto"
  >vLEI</text>
  <!-- Turquoise accent bar -->
  <rect x="16" y="59" width="96" height="4" fill="#51DAC5" rx="2"/>
  <!-- "WALLET" sub-label — white, spaced -->
  <text
    x="64"
    y="80"
    font-family="Calibri, 'Segoe UI', Arial, sans-serif"
    font-size="13"
    font-weight="400"
    fill="#FFFFFF"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="3"
  >WALLET</text>
</svg>
```

> **Note on font rendering:** `sharp` uses librsvg. If Calibri is not installed on the build machine, librsvg falls back to a generic sans-serif. The result still looks correct. If you need pixel-perfect rendering, open the SVG in Inkscape and use "Object → Text to Path" to convert text nodes to `<path>` elements, then save.

- [ ] **Step 2: Regenerate PNG icons**

```bash
node scripts/build-extension-icons.mjs
```

Expected output:
```
Wrote public/vlei-wallet-extension-logo.svg and icon-{16,32,48,128}.png
```

Verify that `public/icon-128.png` shows the new Cyprus-background logo.

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/assets/img/vlei-wallet-extension-logo.svg public/
git commit -m "feat: new vLEI Wallet logo — Cyprus background, turquoise accent, GLEIF wordmark style"
```

---

## Task 5: `useVendorTheme` Hook

**Files:**
- Create: `src/config/useVendorTheme.ts`
- Modify: `src/pages/popup/Popup.tsx` (remove vendor state; import hook)

- [ ] **Step 1: Create `src/config/useVendorTheme.ts`**

```typescript
import { useState } from "react";
import { IVendorData } from "@config/types";
import { mergeVendorTheme } from "@config/merge-vendor-theme";
import { configService } from "@pages/background/services/config";
import { default as defaultVendor } from "@src/config/vendor.json";

export function useVendorTheme() {
  const [vendorData, setVendorData] = useState<IVendorData>(() =>
    mergeVendorTheme(defaultVendor as IVendorData)
  );

  const checkIfVendorDataExists = async () => {
    const resp = await configService.getAgentAndVendorInfo();
    if (resp.vendorData) {
      setVendorData(mergeVendorTheme(resp.vendorData));
    }
  };

  return { vendorData, checkIfVendorDataExists };
}
```

- [ ] **Step 2: Update `src/pages/popup/Popup.tsx` to use the hook**

Remove the `vendorData` state and `checkIfVendorDataExists` function from `Popup.tsx`. Import and use `useVendorTheme` instead.

Find and remove:
```typescript
const [vendorData, setVendorData] = useState<IVendorData>(() =>
  mergeVendorTheme(defaultVendor as IVendorData)
);
```
and:
```typescript
const checkIfVendorDataExists = async () => {
  const resp = await configService.getAgentAndVendorInfo();
  if (resp.vendorData) {
    setVendorData(mergeVendorTheme(resp.vendorData));
  }

  if (!resp.agentUrl || !resp.hasOnboarded) {
    setShowConfig(true);
  }
};
```

Replace with at the top of the component (alongside the other `useState` calls):
```typescript
const { vendorData, checkIfVendorDataExists: loadVendorData } = useVendorTheme();
```

Then update `checkIfVendorDataExists` references in the body of `Popup.tsx` to call `loadVendorData()`. Also, the `setShowConfig(true)` logic that was inline in `checkIfVendorDataExists` needs to stay in Popup.tsx. Update the `useEffect` call:

```typescript
useEffect(() => {
  (async () => {
    await loadVendorData();
    const resp = await configService.getAgentAndVendorInfo();
    if (!resp.agentUrl || !resp.hasOnboarded) {
      setShowConfig(true);
    }
  })();
  checkInitialConnection();
}, []);
```

Add the import at the top of `Popup.tsx`:
```typescript
import { useVendorTheme } from "@config/useVendorTheme";
```

Remove the now-unused imports:
```typescript
// Remove these lines:
import { default as defaultVendor } from "@src/config/vendor.json";
import { mergeVendorTheme } from "@config/merge-vendor-theme";
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/useVendorTheme.ts src/pages/popup/Popup.tsx
git commit -m "refactor: extract useVendorTheme hook from Popup.tsx"
```

---

## Task 6: Split `signify.ts`

**Files:**
- Create: `src/pages/background/services/signify-connection.ts`
- Create: `src/pages/background/services/signify-operations.ts`
- Modify: `src/pages/background/services/signify.ts`

- [ ] **Step 1: Create `src/pages/background/services/signify-connection.ts`**

This file owns the `_client` variable and all lifecycle concerns.

```typescript
import browser from "webextension-polyfill";
import {
  SignifyClient,
  Tier,
  ready,
  randomPasscode,
} from "signify-ts";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import { userService } from "@pages/background/services/user";
import { configService } from "@pages/background/services/config";

const PASSCODE_TIMEOUT = 5;

let _client: SignifyClient | null = null;

const setTimeoutAlarm = () => {
  browser.alarms.create("passcode-timeout", {
    delayInMinutes: PASSCODE_TIMEOUT,
  });
};

const resetTimeoutAlarm = async () => {
  await browser.alarms.clear("passcode-timeout");
  setTimeoutAlarm();
};

/**
 * Returns the active SignifyClient or throws if not connected.
 * Used by signify-operations.ts to access the client.
 */
export const getClient = (): SignifyClient => {
  if (!_client) {
    throw new Error("Signify Client not connected");
  }
  return _client;
};

/**
 * Resets the passcode timeout alarm.
 * Call after any operation that proves the user is active.
 */
export const keepAlive = async (): Promise<void> => {
  await resetTimeoutAlarm();
};

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "passcode-timeout") {
    try {
      const response = await sendMessage({
        type: "sw-check-popup-open" as any,
      });
      if (response.data.isOpened) {
        console.log("Timer expired, but extension is open. Resetting timer.");
        resetTimeoutAlarm();
      }
    } catch (error) {
      console.log("Timer expired, client and passcode zeroed out");
      _client = null;
      await userService.removeControllerId();
      await userService.removePasscode();
    }
  }
});

const getState = async () => {
  return await getClient().state();
};

const SignifyConnection = () => {
  const connect = async (agentUrl: string, passcode: string) => {
    try {
      await ready();
      _client = new SignifyClient(agentUrl, passcode, Tier.low);
      await _client.connect();
      const state = await getState();
      await userService.setControllerId(state?.controller?.state?.i);
      setTimeoutAlarm();
    } catch (error) {
      console.error(error);
      _client = null;
      return { error };
    }
  };

  const bootAndConnect = async (
    agentUrl: string,
    bootUrl: string,
    passcode: string
  ) => {
    try {
      await ready();
      _client = new SignifyClient(agentUrl, passcode, Tier.low, bootUrl);
      await _client.boot();
      await _client.connect();
      const state = await getState();
      await userService.setControllerId(state?.controller?.state?.i);
      setTimeoutAlarm();
    } catch (error) {
      console.error(error);
      _client = null;
      return { error };
    }
  };

  const isConnected = async (): Promise<boolean> => {
    const passcode = await userService.getPasscode();
    const url = await configService.getAgentUrl();
    if (url && passcode && !_client) {
      await connect(url, passcode);
      await resetTimeoutAlarm();
    }
    try {
      const state = await getState();
      console.log("Signify client is connected", _client);
      return _client !== null && !!state?.controller?.state?.i;
    } catch (error) {
      console.log(
        _client
          ? "Signify client is not valid, unable to connect"
          : "Signify client is not connected",
        _client
      );
      return false;
    }
  };

  const disconnect = async () => {
    _client = null;
    await userService.removeControllerId();
    await userService.removePasscode();
  };

  const generatePasscode = (): string => {
    return randomPasscode();
  };

  const getControllerID = async (): Promise<string> => {
    return await userService.getControllerId();
  };

  return {
    connect,
    bootAndConnect,
    isConnected,
    disconnect,
    generatePasscode,
    getControllerID,
  };
};

export const signifyConnectionService = SignifyConnection();
```

- [ ] **Step 2: Create `src/pages/background/services/signify-operations.ts`**

This file imports `getClient` and `keepAlive` from the connection module.

```typescript
import * as signinResource from "@pages/background/resource/signin";
import {
  Saider,
  IssueCredentialResult,
  CredentialData,
} from "signify-ts";
import { sendMessageTab } from "@src/shared/browser/tabs-utils";
import { sessionService } from "@pages/background/services/session";
import { IIdentifier, ISignin, ISessionConfig } from "@config/types";
import {
  formatAsCredentialEdgeOrRuleObject,
  getSchemaFieldOfEdge,
  parseSchemaEdgeOrRuleSection,
  setNodeValueInEdge,
  waitOperation,
} from "@src/shared/signify-utils";
import { getClient, keepAlive, signifyConnectionService } from "./signify-connection";

const SignifyOperations = () => {
  const listIdentifiers = async (): Promise<IIdentifier[]> => {
    const client = getClient();
    let aids: IIdentifier[] = [];
    let start = 0;
    let total = 0;
    do {
      const res = await client.identifiers().list(start);
      if (res.aids?.length === 0) break;
      aids.push(...res.aids);
      total = res.total;
      start = aids.length;
    } while (aids.length < total);
    return aids;
  };

  const listCredentials = async () => {
    return await getClient().credentials().list();
  };

  const getCredential = async (
    credentialIdentifier: string,
    includeCESR: boolean = false
  ) => {
    return await getClient().credentials().get(credentialIdentifier, includeCESR);
  };

  const createAID = async (name: string) => {
    const res = await getClient().identifiers().create(name);
    return await res?.op();
  };

  const createCredential = async (
    name: string,
    args: CredentialData
  ): Promise<IssueCredentialResult | undefined> => {
    return await getClient().credentials().issue(name, args);
  };

  const isGroupAid = (aid: any): boolean => {
    return (
      aid.hasOwnProperty("group") &&
      typeof aid.group === "object" &&
      aid.group !== null
    );
  };

  const getCreateCredentialPrerequisites = async (
    aidName: string,
    schemaSaid: string
  ) => {
    const client = getClient();
    const aid = await client.identifiers().get(aidName);

    const registries = await client.registries().list(aidName);
    if (!registries || registries.length === 0) {
      throw new Error(`No credential registries found for the AID ${aidName}`);
    }

    const schema = await client.schemas().get(schemaSaid);
    if (!schema || schema?.title === "404 Not Found") {
      throw new Error(`Schema not found!`);
    }

    const edgeObject = parseSchemaEdgeOrRuleSection(schema.properties?.e);
    let edge = formatAsCredentialEdgeOrRuleObject(edgeObject);
    const edgeSchema = getSchemaFieldOfEdge(edge);
    if (edge && edgeSchema) {
      const filter = { "-s": edgeSchema, "-a-i": aid?.prefix };
      const creds = await client.credentials().list({ filter, limit: 50 });
      if (creds && creds.length > 0) {
        edge = setNodeValueInEdge(edge, creds[0]?.sad.d);
      }
    }

    const parsedRules = parseSchemaEdgeOrRuleSection(schema.properties?.r);
    const rules = formatAsCredentialEdgeOrRuleObject(parsedRules);

    return { aid, schema, registry: registries[0], rules, edge };
  };

  const authorizeSelectedSignin = async ({
    tabId,
    signin,
    origin,
    config,
  }: {
    tabId: number;
    signin: ISignin;
    origin: string;
    config: ISessionConfig;
  }): Promise<any> => {
    const client = getClient();
    const aidName = signin.identifier
      ? signin.identifier?.name
      : signin.credential?.issueeName;

    let credentialResp;
    if (signin.credential) {
      credentialResp = { raw: signin.credential, cesr: null };
      const cesr = await getCredential(signin.credential?.sad?.d, true);
      credentialResp.cesr = cesr;
    }

    const response: any = {
      credential: credentialResp,
      identifier: signin?.identifier,
    };

    if (config?.sessionOneTime) {
      const sreq = await client.createSignedRequest(aidName!, origin, {});
      const jsonHeaders: { [key: string]: string } = {};
      if (sreq?.headers) {
        for (const pair of sreq.headers.entries()) {
          jsonHeaders[pair[0]] = pair[1];
        }
      }
      response.headers = jsonHeaders;
    } else {
      const sessionInfo = await sessionService.create({
        tabId,
        origin,
        aidName: aidName!,
        signinId: signin.id,
        config,
      });
      if (sessionInfo?.expiry) {
        response.expiry = sessionInfo.expiry;
      }
      await sendMessageTab(tabId, {
        type: "tab",
        subtype: "session-info",
        data: response,
      });
    }

    await keepAlive();
    return response;
  };

  const getSessionInfo = async ({
    tabId,
    origin,
  }: {
    tabId: number;
    origin: string;
  }): Promise<any> => {
    const session = await sessionService.get({ tabId, origin });
    if (!session) return null;

    const signin = await signinResource.getDomainSigninById(origin, session.signinId);
    let credentialResp;
    if (signin?.credential) {
      credentialResp = { raw: signin.credential, cesr: null };
      const cesr = await getCredential(signin.credential?.sad?.d, true);
      credentialResp.cesr = cesr;
    }
    const resp = {
      credential: credentialResp,
      identifier: signin?.identifier,
      expiry: session.expiry,
    };
    await sendMessageTab(tabId, {
      type: "tab",
      subtype: "session-info",
      data: resp,
    });
    await keepAlive();
    return resp;
  };

  const removeSessionInfo = async ({
    tabId,
    origin,
  }: {
    tabId: number;
    origin: string;
  }): Promise<any> => {
    await sessionService.remove(tabId);
    await sendMessageTab(tabId, {
      type: "tab",
      subtype: "session-info",
      data: null,
    });
    await keepAlive();
  };

  const getSignedHeaders = async ({
    origin,
    rurl,
    method = "GET",
    headers = new Headers({}),
    tabId,
  }: {
    origin: string;
    rurl: string;
    method?: string;
    headers?: Headers;
    tabId: number;
  }): Promise<any> => {
    const connected = await signifyConnectionService.isConnected();
    if (!connected) {
      getClient(); // throws "Signify Client not connected"
    }

    const session = await sessionService.get({ tabId, origin });
    await sessionService.incrementRequestCount(tabId);
    if (!session) throw new Error("Session not found");

    const client = getClient();
    const sreq = await client.createSignedRequest(session.aidName, rurl, {
      method,
      headers,
    });
    await keepAlive();

    const jsonHeaders: { [key: string]: string } = {};
    if (sreq?.headers) {
      for (const pair of sreq.headers.entries()) {
        jsonHeaders[pair[0]] = pair[1];
      }
    }
    return { headers: jsonHeaders };
  };

  const createAttestationCredential = async ({
    origin,
    credData,
    schemaSaid,
    tabId,
  }: {
    origin: string;
    credData: any;
    schemaSaid: string;
    tabId: number;
  }): Promise<any> => {
    const connected = await signifyConnectionService.isConnected();
    if (!connected) {
      getClient(); // throws
    }

    const session = await sessionService.get({ tabId, origin });
    const { aid, registry, rules, edge } = await getCreateCredentialPrerequisites(
      session?.aidName!,
      schemaSaid
    );

    if (isGroupAid(aid)) {
      throw new Error(
        `Attestation credential issuance by multisig identifier ${session.aidName} is not supported yet!`
      );
    }

    const credArgs: CredentialData = {
      i: aid.prefix,
      ri: registry.regk,
      s: schemaSaid,
      a: credData,
      r: rules && Object.keys(rules).length > 0
        ? Saider.saidify({ d: "", ...rules })[1]
        : undefined,
      e: edge && Object.keys(edge).length > 0
        ? Saider.saidify({ d: "", ...edge })[1]
        : undefined,
    };

    console.log("create credential args: ", credArgs);
    const credResult = await createCredential(session.aidName, credArgs);
    if (credResult) {
      await waitOperation(getClient(), credResult.op);
    }
    return credResult;
  };

  return {
    listIdentifiers,
    listCredentials,
    getCredential,
    createAID,
    authorizeSelectedSignin,
    getSessionInfo,
    removeSessionInfo,
    getSignedHeaders,
    createAttestationCredential,
  };
};

export const signifyOperationsService = SignifyOperations();
```

- [ ] **Step 3: Replace `src/pages/background/services/signify.ts` with a thin re-export**

```typescript
export { signifyConnectionService } from "./signify-connection";
export { signifyOperationsService } from "./signify-operations";

import { signifyConnectionService } from "./signify-connection";
import { signifyOperationsService } from "./signify-operations";

/**
 * Combined service used by all background handlers.
 * Forwards to signifyConnectionService and signifyOperationsService.
 */
export const signifyService = {
  ...signifyConnectionService,
  ...signifyOperationsService,
};
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. All handlers in `authentication.ts` and `resource.ts` continue to import `signifyService` from `@pages/background/services/signify` unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/background/services/signify-connection.ts src/pages/background/services/signify-operations.ts src/pages/background/services/signify.ts
git commit -m "refactor: split signify.ts into signify-connection and signify-operations"
```

---

## Task 7: `usePopup` Hook

**Files:**
- Create: `src/pages/popup/usePopup.ts`
- Modify: `src/pages/popup/Popup.tsx`

- [ ] **Step 1: Create `src/pages/popup/usePopup.ts`**

```typescript
import { useState, useEffect } from "react";
import { UI_EVENTS } from "@config/event-types";
import { sendMessage } from "@src/shared/browser/runtime-utils";
import { sendMessageTab, getCurrentTab } from "@src/shared/browser/tabs-utils";
import { WEB_APP_PERMS, configService } from "@pages/background/services/config";
import { isValidUrl } from "@shared/utils";
import { useVendorTheme } from "@config/useVendorTheme";

interface IBootAndConnect {
  passcode?: string;
  agentUrl?: string;
  bootUrl: string;
}

interface IConnect {
  passcode?: string;
  agentUrl?: string;
}

export function usePopup() {
  const { vendorData, checkIfVendorDataExists: loadVendorData } = useVendorTheme();
  const [showConfig, setShowConfig] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [permissionData, setPermissionData] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [isCheckingInitialConnection, setIsCheckingInitialConnection] =
    useState(false);

  const checkWebRequestedPermissions = async () => {
    const webRequestedPermissions =
      await configService.getWebRequestedPermissions();
    const requestedVendorUrlChange =
      webRequestedPermissions[WEB_APP_PERMS.SET_VENDOR_URL];
    setPermissionData(requestedVendorUrlChange);
  };

  const checkIfVendorDataExists = async () => {
    await loadVendorData();
    const resp = await configService.getAgentAndVendorInfo();
    if (!resp.agentUrl || !resp.hasOnboarded) {
      setShowConfig(true);
    }
  };

  const checkConnection = async () => {
    const { data } = await sendMessage({
      type: UI_EVENTS.authentication_check_agent_connection,
    });
    setIsConnected(!!data.isConnected);
    if (data.isConnected) {
      try {
        const tab = await getCurrentTab();
        const { data: tabData } = await sendMessageTab(tab.id!, {
          type: "tab",
          subtype: "get-tab-state",
        });
        sendMessageTab(tab.id!, {
          type: "tab",
          subtype: "reload-state",
          eventType: tabData?.tabState,
        });
      } catch (error) {
        console.log("Error in popup from sendMessageTab", error);
      }
    }
  };

  const checkInitialConnection = async () => {
    setIsCheckingInitialConnection(true);
    await checkWebRequestedPermissions();
    await checkConnection();
    setIsCheckingInitialConnection(false);
  };

  useEffect(() => {
    checkIfVendorDataExists();
    checkInitialConnection();
  }, []);

  const clearConnectError = () => {
    setTimeout(() => setConnectError(""), 3000);
  };

  const handleBootAndConnect = async (passcode: string) => {
    const agentUrl = await configService.getAgentUrl();
    const bootUrl = await configService.getBootUrl();
    const urlObject = isValidUrl(agentUrl);
    if (!urlObject || !urlObject?.origin) return;

    setIsLoading(true);
    const { error } = await sendMessage<IBootAndConnect>({
      type: UI_EVENTS.authentication_boot_connect_agent,
      data: { passcode, agentUrl, bootUrl },
    });
    setIsLoading(false);

    if (error) {
      setConnectError(error?.message);
      clearConnectError();
    } else {
      setShowSignup(false);
      await checkConnection();
    }
  };

  const handleConnect = async (passcode: string) => {
    setIsLoading(true);
    const agentUrl = await configService.getAgentUrl();
    const { error } = await sendMessage<IConnect>({
      type: UI_EVENTS.authentication_connect_agent,
      data: { passcode, agentUrl },
    });
    setIsLoading(false);

    if (error) {
      setConnectError(error?.message);
      clearConnectError();
    } else {
      await checkConnection();
    }
  };

  const handleDisconnect = async () => {
    await sendMessage({ type: UI_EVENTS.authentication_disconnect_agent });
    checkConnection();
  };

  const handleDisconnectPermission = async () => {
    await sendMessage({ type: UI_EVENTS.authentication_disconnect_agent });
    await checkConnection();
    checkIfVendorDataExists();
    checkWebRequestedPermissions();
  };

  return {
    vendorData,
    showConfig,
    setShowConfig,
    showSignup,
    setShowSignup,
    permissionData,
    isConnected,
    isLoading,
    connectError,
    isCheckingInitialConnection,
    checkIfVendorDataExists,
    handleBootAndConnect,
    handleConnect,
    handleDisconnect,
    handleDisconnectPermission,
  };
}
```

- [ ] **Step 2: Replace `src/pages/popup/Popup.tsx` with the slimmed version**

```typescript
import { Toaster } from "react-hot-toast";
import { createGlobalStyle } from "styled-components";
import { ThemeProvider, styled } from "styled-components";
import { LocaleProvider } from "@src/_locales";
import { Permission } from "@src/screens/permission";
import { Signin } from "@src/screens/signin";
import { Signup } from "@src/screens/signup";
import { Loader, Box } from "@components/ui";
import { Main } from "@components/main";
import { usePopup } from "./usePopup";

export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #__root {
    height: 100%;
    min-height: 386px;
  }

  body {
    font-family: "Facundo", "Calibri", system-ui, -apple-system, "Segoe UI",
                 "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.4;
    letter-spacing: 0.01em;
    background: ${({ theme }) => theme?.colors?.bodyBg};
    color: ${({ theme }) => theme?.colors?.black};
    border: ${({ theme }) =>
      `1px solid ${theme?.colors?.bodyBorder ?? theme?.colors?.bodyBg}`};
    transition: background 0.2s ease-in, color 0.2s ease-in;
  }

  :root {
    --toast-surface: ${({ theme }) => theme?.colors?.secondary ?? "#027361"};
    --toast-on-surface: ${({ theme }) => theme?.colors?.white ?? "#fff"};
  }

  *:focus-visible {
    outline: 2px solid ${({ theme }) => theme?.colors?.accent ?? theme?.colors?.primary};
    outline-offset: 2px;
  }

  ul {
    list-style-type: none;
    padding: 0;

    > li {
      margin-bottom: 8px;
    }
  }
`;

const StyledLoaderBox = styled(Box)`
  color: ${(props) => props.theme?.colors?.accent ?? props.theme?.colors?.primary};
`;

export default function Popup(): JSX.Element {
  const {
    vendorData,
    showConfig,
    setShowConfig,
    showSignup,
    setShowSignup,
    permissionData,
    isConnected,
    isLoading,
    connectError,
    isCheckingInitialConnection,
    checkIfVendorDataExists,
    handleBootAndConnect,
    handleConnect,
    handleDisconnect,
    handleDisconnectPermission,
  } = usePopup();

  const logo = vendorData?.logo ?? "/vlei-wallet-extension-logo.svg";

  return (
    <LocaleProvider>
      <ThemeProvider theme={vendorData?.theme}>
        <GlobalStyles />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "12px",
              background: "var(--toast-surface)",
              color: "var(--toast-on-surface)",
              fontFamily:
                '"Facundo", "Calibri", system-ui, "Segoe UI", sans-serif',
              fontSize: "14px",
              boxShadow: "0 8px 24px rgba(0, 51, 54, 0.25)",
            },
          }}
        />
        <div>
          {isCheckingInitialConnection ? (
            <Box width="300px">
              <StyledLoaderBox margin="auto" width={64} height={64}>
                <Loader size={12} />
              </StyledLoaderBox>
            </Box>
          ) : (
            <>
              {permissionData ? (
                <Box width="300px">
                  <Permission
                    isConnected={isConnected}
                    permissionData={permissionData}
                    afterCallback={() => {
                      checkIfVendorDataExists();
                    }}
                    handleDisconnect={handleDisconnectPermission}
                  />
                </Box>
              ) : showSignup ? (
                <Box width="300px">
                  <Signup
                    isLoading={isLoading}
                    handleBootAndConnect={handleBootAndConnect}
                    signupError={connectError}
                  />
                </Box>
              ) : (
                <>
                  {isConnected ? (
                    <Main
                      handleDisconnect={handleDisconnect}
                      logo={logo}
                      title={vendorData?.title}
                      docsUrl={vendorData?.docsUrl}
                    />
                  ) : (
                    <Box width="300px">
                      <Signin
                        signinError={connectError}
                        handleConnect={handleConnect}
                        isLoading={isLoading}
                        logo={logo}
                        title={vendorData?.title}
                        afterSetUrl={checkIfVendorDataExists}
                        vendorData={vendorData}
                        showConfig={showConfig}
                        setShowConfig={setShowConfig}
                        handleSignup={() => setShowSignup(true)}
                      />
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </ThemeProvider>
    </LocaleProvider>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/popup/usePopup.ts src/pages/popup/Popup.tsx src/config/useVendorTheme.ts
git commit -m "refactor: extract usePopup hook, slim Popup.tsx to pure render component"
```

---

## Task 8: `IHandler<T>` Generic + Handler Cleanup

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/pages/background/handlers/authentication.ts`
- Modify: `src/pages/background/handlers/resource.ts`

- [ ] **Step 1: Make `IHandler` generic in `src/config/types.ts`**

Replace the existing `IHandler` interface:
```typescript
export interface IHandler<T = unknown> {
  sendResponse: (response?: any) => void;
  tabId?: number;
  url?: string;
  data?: T;
}
```

- [ ] **Step 2: Define data types and update `src/pages/background/handlers/authentication.ts`**

```typescript
import { signifyService } from "@pages/background/services/signify";
import { userService } from "@pages/background/services/user";
import { getDomainFromUrl } from "@shared/utils";
import { IHandler, ISignin, ISessionConfig } from "@config/types";

interface IConnectData {
  agentUrl: string;
  passcode: string;
}

interface IBootConnectData {
  agentUrl: string;
  bootUrl: string;
  passcode: string;
}

interface IAuthData {
  signin: ISignin;
  config: ISessionConfig;
}

export async function handleCheckAgentConnection({
  sendResponse,
  url,
}: IHandler) {
  const isConnected = await signifyService.isConnected();
  sendResponse({ data: { isConnected, tabUrl: url } });
}

export async function handleDisconnectAgent({ sendResponse }: IHandler) {
  await signifyService.disconnect();
  sendResponse({ data: { isConnected: false } });
}

export async function handleConnectAgent({
  sendResponse,
  data,
}: IHandler<IConnectData>) {
  const resp = (await signifyService.connect(
    data!.agentUrl,
    data!.passcode
  )) as any;
  if (resp?.error) {
    sendResponse({
      error: { code: 404, message: resp?.error?.message },
    });
  } else {
    await userService.setPasscode(data!.passcode);
    sendResponse({ data: { success: true } });
  }
}

export async function handleBootConnectAgent({
  sendResponse,
  data,
}: IHandler<IBootConnectData>) {
  const resp = (await signifyService.bootAndConnect(
    data!.agentUrl,
    data!.bootUrl,
    data!.passcode
  )) as any;
  if (resp?.error) {
    sendResponse({
      error: { code: 404, message: resp?.error?.message },
    });
  } else {
    await userService.setPasscode(data!.passcode);
    sendResponse({ data: { success: true } });
  }
}

export async function handleGeneratePasscode({ sendResponse }: IHandler) {
  const passcode = signifyService.generatePasscode();
  sendResponse({ data: { passcode } });
}

export async function handleGetAuthData({
  sendResponse,
  tabId,
  url,
  data,
}: IHandler<IAuthData>) {
  try {
    const resp = await signifyService.authorizeSelectedSignin({
      tabId: tabId!,
      signin: data!.signin,
      origin: getDomainFromUrl(url!),
      config: data!.config,
    });
    sendResponse({ data: resp });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleGetSessionInfo({
  sendResponse,
  tabId,
  url,
}: IHandler) {
  try {
    const resp = await signifyService.getSessionInfo({
      tabId: tabId!,
      origin: getDomainFromUrl(url!),
    });
    sendResponse({ data: resp });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleClearSession({
  sendResponse,
  tabId,
  url,
}: IHandler) {
  try {
    const resp = await signifyService.removeSessionInfo({
      tabId: tabId!,
      origin: getDomainFromUrl(url!),
    });
    sendResponse({ data: resp });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}
```

- [ ] **Step 3: Define data types and update `src/pages/background/handlers/resource.ts`**

```typescript
import * as signinResource from "@pages/background/resource/signin";
import { signifyService } from "@pages/background/services/signify";
import { getDomainFromUrl } from "@shared/utils";
import { IHandler, IIdentifier, ICredential, ISignin } from "@config/types";
import { getCurrentUrl } from "@pages/background/utils";

interface IFetchSignedHeadersData {
  url: string;
  method: string;
  headers: Headers;
}

interface IFetchCredentialData {
  id: string;
  includeCESR: boolean;
}

interface ICreateIdentifierData {
  name: string;
}

interface ICreateSigninData {
  identifier?: IIdentifier;
  credential?: ICredential;
}

interface ICreateAttestationData {
  credData: unknown;
  schemaSaid: string;
}

interface IUpdateAutoSigninData {
  signin: ISignin;
}

interface IDeleteSigninData {
  id: string;
}

export async function handleFetchAutoSigninSignature({
  sendResponse,
  tabId,
  url,
}: IHandler) {
  const signins = await signinResource.getDomainSignins(url);
  const autoSignin = signins?.find((signin) => signin.autoSignin);
  if (!signins?.length || !autoSignin) {
    sendResponse({ error: { code: 404, message: "auto signin not found" } });
    return;
  }
  try {
    const isig = await signifyService.authorizeSelectedSignin({
      tabId: tabId!,
      signin: autoSignin,
      origin: getDomainFromUrl(url!),
      config: { sessionOneTime: true },
    });
    sendResponse({ data: isig });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleFetchSignifyHeaders({
  sendResponse,
  url,
  tabId,
  data,
}: IHandler<IFetchSignedHeadersData>) {
  try {
    const isig = await signifyService.getSignedHeaders({
      origin: getDomainFromUrl(url!),
      rurl: data!.url,
      method: data!.method,
      headers: data!.headers,
      tabId: tabId!,
    });
    sendResponse({ data: isig });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleFetchTabSignin({ sendResponse, url }: IHandler) {
  try {
    const signins = await signinResource.getDomainSignins(url);
    const autoSigninObj = signins?.find((signin) => signin.autoSignin);
    sendResponse({ data: { signins: signins ?? [], autoSigninObj } });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleFetchIdentifiers({ sendResponse }: IHandler) {
  try {
    const identifiers = await signifyService.listIdentifiers();
    sendResponse({ data: { aids: identifiers ?? [] } });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleFetchSignins({ sendResponse }: IHandler) {
  const signins = await signinResource.getSignins();
  sendResponse({ data: { signins } });
}

export async function handleFetchCredentials({ sendResponse }: IHandler) {
  const credentials = await signifyService.listCredentials();
  const identifiers = await signifyService.listIdentifiers();
  credentials?.forEach(async (credential: ICredential) => {
    const issueePrefix = credential.sad.a.i;
    const aidIssuee = identifiers.find(
      (aid: IIdentifier) => aid.prefix === issueePrefix
    );
    credential.issueeName = aidIssuee?.name!;
  });
  try {
    sendResponse({ data: { credentials: credentials ?? [] } });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleFetchCredential({
  sendResponse,
  data,
}: IHandler<IFetchCredentialData>) {
  const cred = await signifyService.getCredential(data!.id, data!.includeCESR);
  sendResponse({ data: { credential: cred ?? null } });
}

export async function handleCreateIdentifier({
  sendResponse,
  data,
}: IHandler<ICreateIdentifierData>) {
  try {
    const resp = await signifyService.createAID(data!.name);
    sendResponse({ data: { ...(resp ?? {}) } });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleCreateSignin({
  sendResponse,
  data,
}: IHandler<ICreateSigninData>) {
  const signins = await signinResource.getSignins();
  const currentUrl = await getCurrentUrl();
  const { identifier, credential } = data!;
  let signinExists = false;

  if (identifier && identifier.prefix) {
    signinExists = Boolean(
      signins?.find(
        (signin) =>
          signin.domain === currentUrl?.origin &&
          signin?.identifier?.prefix === identifier.prefix
      )
    );
  }
  if (credential && credential.sad.d) {
    signinExists = Boolean(
      signins?.find(
        (signin) =>
          signin.domain === currentUrl?.origin &&
          signin?.credential?.sad?.d === credential.sad.d
      )
    );
  }

  if (signinExists) {
    sendResponse({ data: { signins } });
  } else {
    const signinObj = signinResource.newSigninObject({
      identifier,
      credential,
      domain: currentUrl!.origin,
    });
    if (signins?.length) {
      await signinResource.updateSignins([...signins, signinObj]);
    } else {
      await signinResource.updateSignins([signinObj]);
    }
    const storageSignins = await signinResource.getSignins();
    sendResponse({ data: { signins: storageSignins } });
  }
}

export async function handleCreateAttestationCredential({
  sendResponse,
  url,
  tabId,
  data,
}: IHandler<ICreateAttestationData>) {
  try {
    const resp = await signifyService.createAttestationCredential({
      origin: getDomainFromUrl(url!),
      credData: data!.credData,
      schemaSaid: data!.schemaSaid,
      tabId: tabId!,
    });
    sendResponse({ data: { ...resp } });
  } catch (error: any) {
    sendResponse({ error: { code: 503, message: error?.message } });
  }
}

export async function handleUpdateAutoSignin({
  sendResponse,
  data,
}: IHandler<IUpdateAutoSigninData>) {
  const resp = await signinResource.updateDomainAutoSignin(data?.signin);
  sendResponse({ data: { ...resp } });
}

export async function handleDeleteSignin({
  sendResponse,
  data,
}: IHandler<IDeleteSigninData>) {
  const resp = await signinResource.deleteSigninById(data?.id);
  sendResponse({ data: { ...resp } });
}
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/config/types.ts src/pages/background/handlers/authentication.ts src/pages/background/handlers/resource.ts
git commit -m "refactor: make IHandler generic, add typed data interfaces to all handlers"
```

---

## Task 9: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add CLAUDE.md reference to README**

In the `## Table of Contents` section of `README.md`, add a new entry:

```markdown
- [Developer Guide (CLAUDE.md)](CLAUDE.md)
```

Place it after `- [Contributing]` or at the end of the list.

- [ ] **Step 2: Build to verify the final state of the repo**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: link to CLAUDE.md from README"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| CLAUDE.md with all described sections | Task 1 |
| Remove `tailwind.config.cjs` | Task 2 |
| Clean `vite.config.ts` dead code | Task 2 |
| Replace `vendor.json` color palette | Task 3 |
| Add `accent` token to `IVendorData` | Task 3 |
| Update button to use `accent` | Task 3 |
| Update font stack in GlobalStyles | Task 3 |
| New 128×128 SVG logo | Task 4 |
| Regenerate PNG icons | Task 4 |
| `useVendorTheme` hook | Task 5 |
| Split `signify.ts` → connection + operations | Task 6 |
| `usePopup` hook + slim `Popup.tsx` | Task 7 |
| `IHandler<T>` generic | Task 8 |
| README update | Task 9 |

All spec requirements are covered. No placeholders remain.
