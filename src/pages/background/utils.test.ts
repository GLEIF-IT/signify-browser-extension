import { describe, expect, it, vi } from "vitest";

vi.mock("webextension-polyfill", () => ({ default: { runtime: { id: "ext-id" } } }));
vi.mock("@src/shared/browser/tabs-utils", () => ({ getCurrentTab: vi.fn() }));

import { senderIsIssueConfirm } from "./utils";

const sender = (url: string | undefined, id = "ext-id") => ({ url, id }) as any;

describe("senderIsIssueConfirm", () => {
  it("accepts the extension's own confirmation page, with its query string", () => {
    expect(senderIsIssueConfirm(sender("chrome-extension://ext-id/src/pages/issue-confirm/index.html?id=abc"))).toBe(true);
    expect(senderIsIssueConfirm(sender("moz-extension://uuid/src/pages/issue-confirm/index.html?id=abc"))).toBe(true);
  });

  it("rejects other extension pages, web pages and foreign extension ids", () => {
    expect(senderIsIssueConfirm(sender("chrome-extension://ext-id/src/pages/popup/index.html"))).toBe(false);
    expect(senderIsIssueConfirm(sender("https://evil.example/src/pages/issue-confirm/index.html"))).toBe(false);
    expect(senderIsIssueConfirm(sender("chrome-extension://other/src/pages/issue-confirm/index.html?id=a", "other"))).toBe(false);
    expect(senderIsIssueConfirm(sender(undefined))).toBe(false);
  });
});
