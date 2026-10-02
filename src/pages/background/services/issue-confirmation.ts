import browser from "webextension-polyfill";
import { nanoid } from "nanoid";
import type { IssueSummary } from "./credential-issuance";

export const CONFIRM_PAGE_PATH = "src/pages/issue-confirm/index.html";
export const CONFIRM_TIMEOUT_MS = 120_000;

interface Pending {
  summary: IssueSummary;
  decide: (approved: boolean) => void;
}

// Held in the service worker's memory: if the worker restarts mid-wait the request is lost and the
// confirmation page shows "request expired" (spec §6).
const pending = new Map<string, Pending>();

/**
 * Opens an extension-owned popup window showing `summary` and resolves with the user's decision.
 * Resolves `true` only on Approve; Deny, closing the window, a window-creation failure, or the
 * timeout all resolve `false`. Every path deletes the pending request.
 */
export function requestApproval(summary: IssueSummary): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = nanoid();
    let windowId: number | undefined;

    const settle = (approved: boolean, closeWindow: boolean) => {
      if (!pending.has(id)) return;
      clearTimeout(timer);
      pending.delete(id);
      browser.windows.onRemoved.removeListener(onRemoved);
      if (closeWindow && windowId !== undefined) {
        browser.windows.remove(windowId).catch(() => {});
      }
      resolve(approved);
    };

    const onRemoved = (removedWindowId: number) => {
      if (removedWindowId === windowId) settle(false, false);
    };

    const timer = setTimeout(() => settle(false, true), CONFIRM_TIMEOUT_MS);

    pending.set(id, { summary, decide: (approved) => settle(approved, true) });
    browser.windows.onRemoved.addListener(onRemoved);

    browser.windows
      .create({
        url: `${browser.runtime.getURL(CONFIRM_PAGE_PATH)}?id=${id}`,
        type: "popup",
        width: 540,
        height: 680,
      })
      .then((created) => {
        windowId = created.id;
      })
      .catch(() => settle(false, false));
  });
}

export function getPendingSummary(id: string): IssueSummary | null {
  return pending.get(id)?.summary ?? null;
}

/** Applies the user's decision; `false` if `id` is not a pending request (unknown or already settled). */
export function decide(id: string, approved: boolean): boolean {
  const request = pending.get(id);
  if (!request) return false;
  request.decide(approved);
  return true;
}
